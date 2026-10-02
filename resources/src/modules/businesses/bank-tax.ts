import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import {
  computePaidUntil,
  dailyBusinessTax,
  formatRentDate,
  taxAmountForDays,
} from "./tax-math";
import { isTaxLastDay } from "./tax";
import {
  findOwnedBusiness,
  payBusinessTax,
  setBusinessBalance,
  setBusinessTaxPaidUntil,
  withdrawBusinessBalance,
} from "./repository";

export const BANK_BIZ_TAX_INFO_DIALOG_ID = 71;
export const BANK_BIZ_TAX_CONFIRM_DIALOG_ID = 72;
export const BANK_BIZ_EMPTY_DIALOG_ID = 73;
export const BANK_BIZ_TAX_DAYS_DIALOG_ID = 74;
export const BANK_BIZ_MENU_DIALOG_ID = 80;
export const BANK_BIZ_WITHDRAW_INPUT_DIALOG_ID = 81;
export const BANK_BIZ_WITHDRAW_CONFIRM_DIALOG_ID = 82;

/** @deprecated use BANK_BIZ_EMPTY_DIALOG_ID */
export const BANK_BIZ_TAX_EMPTY_DIALOG_ID = BANK_BIZ_EMPTY_DIALOG_ID;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_LIST = 2;
const MAX_TAX_DAYS = 999;
const MAX_MONEY = 2_147_483_647;

const BIZ_MENU_ITEMS = ["Оплатить бизнес", "Снять деньги с бизнеса"] as const;

type PendingTax = {
  businessId: number;
  days: number;
  amount: number;
  paidUntil: string;
};

type PendingWithdraw = {
  businessId: number;
  amount: number;
};

const pendingTax = new Map<number, PendingTax>();
const pendingWithdraw = new Map<number, PendingWithdraw>();
const payingTax = new Set<number>();
const withdrawing = new Set<number>();

export function clearBusinessTaxPending(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingTax.delete(id);
    pendingWithdraw.delete(id);
  }
}

/** Вход из банка: пункт «Бизнес». */
export function showBusinessBankMenu(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business) {
    try {
      Dialog.show(
        player,
        BANK_BIZ_EMPTY_DIALOG_ID,
        DIALOG_STYLE_MSGBOX,
        "Бизнес",
        "У вас нет бизнеса.",
        "Назад",
        ""
      );
    } catch {
      player.sendClientMessage(Color.error, "У вас нет бизнеса.");
    }
    return;
  }

  try {
    Dialog.show(
      player,
      BANK_BIZ_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Бизнес",
      BIZ_MENU_ITEMS.join("\n"),
      "Выбрать",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть меню бизнеса.");
  }
}

export function showBusinessTaxMenu(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business) {
    showBusinessBankMenu(player);
    return;
  }

  const daily = dailyBusinessTax(business.price);
  const lines = [
    `${business.name} (#${business.id})`,
    `Оплачено до: ${formatRentDate(business.taxPaidUntil)}`,
    `Ежедневный налог: ${formatMoney(daily)}`,
  ];

  if (isTaxLastDay(business)) {
    lines.push("");
    lines.push("Сегодня последний оплаченный день.");
    lines.push("Завтра в 00:00 бизнес будет изъят, если не оплатите.");
  }

  try {
    Dialog.show(
      player,
      BANK_BIZ_TAX_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Оплата бизнеса",
      lines.join("\n"),
      "Далее",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть оплату бизнеса.");
  }
}

function showDaysInputDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business) {
    player.sendClientMessage(Color.error, "У вас нет бизнеса.");
    return;
  }

  const daily = dailyBusinessTax(business.price);
  const bank = Math.max(0, Math.floor(account.bank));
  const body = [
    `${business.name} (#${business.id})`,
    `Ежедневный налог: ${formatMoney(daily)}`,
    `Банковский счёт: ${formatMoney(bank)}`,
    "",
    "Введите количество дней:",
  ].join("\n");

  try {
    Dialog.show(
      player,
      BANK_BIZ_TAX_DAYS_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Оплата бизнеса",
      body,
      "Далее",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть ввод дней.");
  }
}

function showWithdrawInputDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business) {
    player.sendClientMessage(Color.error, "У вас нет бизнеса.");
    return;
  }

  const body = [
    `${business.name} (#${business.id})`,
    `Прибыль на счёте: ${formatMoney(business.balance)}`,
    "",
    "Введите сумму снятия:",
  ].join("\n");

  try {
    Dialog.show(
      player,
      BANK_BIZ_WITHDRAW_INPUT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Снятие с бизнеса",
      body,
      "Далее",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть снятие.");
  }
}

export function handleBusinessTaxDialog(
  player: Player,
  dialogId: number,
  ok: boolean,
  listItem: number,
  inputText: string
): boolean {
  if (
    dialogId !== BANK_BIZ_TAX_INFO_DIALOG_ID &&
    dialogId !== BANK_BIZ_TAX_DAYS_DIALOG_ID &&
    dialogId !== BANK_BIZ_TAX_CONFIRM_DIALOG_ID &&
    dialogId !== BANK_BIZ_EMPTY_DIALOG_ID &&
    dialogId !== BANK_BIZ_MENU_DIALOG_ID &&
    dialogId !== BANK_BIZ_WITHDRAW_INPUT_DIALOG_ID &&
    dialogId !== BANK_BIZ_WITHDRAW_CONFIRM_DIALOG_ID
  ) {
    return false;
  }

  if (dialogId === BANK_BIZ_EMPTY_DIALOG_ID) {
    return true;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return true;
  }

  if (dialogId === BANK_BIZ_MENU_DIALOG_ID) {
    if (!ok) {
      clearBusinessTaxPending(player);
      return true;
    }

    if (listItem === 0 || BIZ_MENU_ITEMS[0]?.toLowerCase() === inputText.trim().toLowerCase()) {
      showBusinessTaxMenu(player);
      return true;
    }

    if (listItem === 1 || BIZ_MENU_ITEMS[1]?.toLowerCase() === inputText.trim().toLowerCase()) {
      showWithdrawInputDialog(player);
      return true;
    }

    showBusinessBankMenu(player);
    return true;
  }

  if (dialogId === BANK_BIZ_TAX_INFO_DIALOG_ID) {
    if (!ok) {
      clearBusinessTaxPending(player);
      showBusinessBankMenu(player);
      return true;
    }

    showDaysInputDialog(player);
    return true;
  }

  if (dialogId === BANK_BIZ_TAX_DAYS_DIALOG_ID) {
    if (!ok) {
      clearBusinessTaxPending(player);
      showBusinessTaxMenu(player);
      return true;
    }

    const business = findOwnedBusiness(account.id);
    if (!business) {
      player.sendClientMessage(Color.error, "У вас нет бизнеса.");
      return true;
    }

    const days = parseTaxDays(inputText);
    if (days === null) {
      player.sendClientMessage(Color.error, "Введите целое число дней от 1 до 999.");
      showDaysInputDialog(player);
      return true;
    }

    const amount = taxAmountForDays(business.price, days);
    const bank = Math.max(0, Math.floor(account.bank));
    if (amount > bank) {
      player.sendClientMessage(Color.error, "Недостаточно денег на банковском счёте.");
      showDaysInputDialog(player);
      return true;
    }

    const paidUntil = computePaidUntil(business.taxPaidUntil, days);
    pendingTax.set(slotId, {
      businessId: business.id,
      days,
      amount,
      paidUntil,
    });

    try {
      Dialog.show(
        player,
        BANK_BIZ_TAX_CONFIRM_DIALOG_ID,
        DIALOG_STYLE_MSGBOX,
        "Подтверждение",
        [
          `${business.name} (#${business.id})`,
          `Оплата: ${days} ${dayLabel(days)} — ${formatMoney(amount)}`,
          `Новая дата оплаты: ${formatRentDate(paidUntil)}`,
          "",
          "Списание с банковского счёта.",
        ].join("\n"),
        "Оплатить",
        "Назад"
      );
    } catch {
      clearBusinessTaxPending(player);
      player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
    }
    return true;
  }

  if (dialogId === BANK_BIZ_TAX_CONFIRM_DIALOG_ID) {
    if (!ok) {
      clearBusinessTaxPending(player);
      showDaysInputDialog(player);
      return true;
    }

    void confirmBusinessTax(player);
    return true;
  }

  if (dialogId === BANK_BIZ_WITHDRAW_INPUT_DIALOG_ID) {
    if (!ok) {
      pendingWithdraw.delete(slotId);
      showBusinessBankMenu(player);
      return true;
    }

    const business = findOwnedBusiness(account.id);
    if (!business) {
      player.sendClientMessage(Color.error, "У вас нет бизнеса.");
      return true;
    }

    const amount = parseAmount(inputText);
    if (amount === null) {
      player.sendClientMessage(Color.error, "Введите целую сумму больше 0.");
      showWithdrawInputDialog(player);
      return true;
    }

    if (amount > business.balance) {
      player.sendClientMessage(Color.error, "На счёте бизнеса недостаточно средств.");
      showWithdrawInputDialog(player);
      return true;
    }

    const cash = Math.max(0, Math.floor(account.money));
    if (cash > MAX_MONEY - amount) {
      player.sendClientMessage(Color.error, "Нельзя нести столько наличных.");
      showWithdrawInputDialog(player);
      return true;
    }

    pendingWithdraw.set(slotId, { businessId: business.id, amount });

    try {
      Dialog.show(
        player,
        BANK_BIZ_WITHDRAW_CONFIRM_DIALOG_ID,
        DIALOG_STYLE_MSGBOX,
        "Подтверждение",
        [
          `${business.name} (#${business.id})`,
          `Снять: ${formatMoney(amount)}`,
          `Останется на счёте: ${formatMoney(business.balance - amount)}`,
          "",
          "Деньги будут выданы наличными.",
        ].join("\n"),
        "Снять",
        "Назад"
      );
    } catch {
      pendingWithdraw.delete(slotId);
      player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
    }
    return true;
  }

  if (dialogId === BANK_BIZ_WITHDRAW_CONFIRM_DIALOG_ID) {
    if (!ok) {
      pendingWithdraw.delete(slotId);
      showWithdrawInputDialog(player);
      return true;
    }

    void confirmBusinessWithdraw(player);
    return true;
  }

  return true;
}

async function confirmBusinessTax(player: Player): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const pending = pendingTax.get(slotId);
  if (!pending) {
    showBusinessTaxMenu(player);
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business || business.id !== pending.businessId) {
    clearBusinessTaxPending(player);
    player.sendClientMessage(Color.error, "У вас нет бизнеса.");
    return;
  }

  if (payingTax.has(account.id)) {
    return;
  }

  payingTax.add(account.id);
  let result;
  try {
    result = await payBusinessTax(account.id, business.id, pending.days);
  } catch (error: unknown) {
    payingTax.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] оплата бизнеса ${business.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Оплата не прошла. Попробуйте ещё раз.");
    return;
  }
  payingTax.delete(account.id);
  clearBusinessTaxPending(player);

  if (!result.ok) {
    if (result.reason === "owner") {
      player.sendClientMessage(Color.error, "У вас нет бизнеса.");
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(Color.error, "Недостаточно денег на банковском счёте.");
      showDaysInputDialog(player);
      return;
    }
    player.sendClientMessage(Color.error, "Оплата не прошла. Попробуйте ещё раз.");
    return;
  }

  // БД уже обновлена в транзакции — кэш всегда синхронизируем.
  setBusinessTaxPaidUntil(business.id, result.paidUntil);

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  patchAccount(player, { bank: result.bankLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  player.sendClientMessage(
    Color.tryOk,
    `Бизнес #${business.id} оплачен на ${pending.days} ${dayLabel(pending.days)}. Оплачено до: ${formatRentDate(result.paidUntil)}.`
  );
  player.sendClientMessage(
    Color.info,
    `С банковского счёта списано ${formatMoney(result.amount)}. Баланс: ${formatMoney(result.bankLeft)}.`
  );
}

async function confirmBusinessWithdraw(player: Player): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const pending = pendingWithdraw.get(slotId);
  if (!pending) {
    showBusinessBankMenu(player);
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business || business.id !== pending.businessId) {
    pendingWithdraw.delete(slotId);
    player.sendClientMessage(Color.error, "У вас нет бизнеса.");
    return;
  }

  if (withdrawing.has(account.id)) {
    return;
  }

  withdrawing.add(account.id);
  let result;
  try {
    result = await withdrawBusinessBalance(account.id, business.id, pending.amount);
  } catch (error: unknown) {
    withdrawing.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] снятие с бизнеса ${business.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Снятие не прошло. Попробуйте ещё раз.");
    return;
  }
  withdrawing.delete(account.id);
  pendingWithdraw.delete(slotId);

  if (!result.ok) {
    if (result.reason === "owner") {
      player.sendClientMessage(Color.error, "У вас нет бизнеса.");
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(Color.error, "На счёте бизнеса недостаточно средств.");
      showWithdrawInputDialog(player);
      return;
    }
    player.sendClientMessage(Color.error, "Снятие не прошло. Попробуйте ещё раз.");
    return;
  }

  // БД уже обновлена в транзакции — кэш всегда синхронизируем.
  setBusinessBalance(business.id, result.balanceLeft);

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  player.sendClientMessage(
    Color.tryOk,
    `Вы сняли ${formatMoney(result.amount)} с бизнеса #${business.id}. Наличные: ${formatMoney(result.cashLeft)}.`
  );
  player.sendClientMessage(
    Color.info,
    `На счёте бизнеса осталось ${formatMoney(result.balanceLeft)}.`
  );
}

function parseTaxDays(input: string): number | null {
  const raw = input.trim();
  if (!/^\d+$/.test(raw) || raw.length > 3) {
    return null;
  }

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_TAX_DAYS) {
    return null;
  }

  return days;
}

function parseAmount(input: string): number | null {
  const raw = input.trim().replace(/^\$/, "");
  if (!/^\d+$/.test(raw) || raw.length > 10) {
    return null;
  }

  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_MONEY) {
    return null;
  }

  return amount;
}

function dayLabel(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }
  return "дней";
}
