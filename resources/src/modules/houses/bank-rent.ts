import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { houseClassLabel } from "./classes";
import {
  computePaidUntil,
  dailyHouseRent,
  formatRentDate,
  rentAmountForDays,
} from "./rent-math";
import { isRentLastDay } from "./rent";
import { findOwnedHouse, payHouseRent, setHouseRentPaidUntil } from "./repository";

export const BANK_HOUSE_RENT_INFO_DIALOG_ID = 47;
export const BANK_HOUSE_RENT_CONFIRM_DIALOG_ID = 48;
export const BANK_HOUSE_RENT_EMPTY_DIALOG_ID = 49;
export const BANK_HOUSE_RENT_DAYS_DIALOG_ID = 51;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const MAX_RENT_DAYS = 999;

type PendingRent = {
  houseId: number;
  days: number;
  amount: number;
  paidUntil: string;
};

const pendingRent = new Map<number, PendingRent>();
const payingRent = new Set<number>();

export function clearHouseRentPending(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingRent.delete(id);
  }
}

export function showHouseRentMenu(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    try {
      Dialog.show(
        player,
        BANK_HOUSE_RENT_EMPTY_DIALOG_ID,
        DIALOG_STYLE_MSGBOX,
        "Оплата дома",
        "У вас нет дома.",
        "Назад",
        ""
      );
    } catch {
      player.sendClientMessage(Color.error, "У вас нет дома.");
    }
    return;
  }

  const daily = dailyHouseRent(house.price);
  const lines = [
    `Дом №${house.id} (${houseClassLabel(house.classId)})`,
    `Оплачено до: ${formatRentDate(house.rentPaidUntil)}`,
    `Ежедневная плата: $${daily}`,
  ];

  if (isRentLastDay(house)) {
    lines.push("");
    lines.push("Сегодня последний оплаченный день.");
    lines.push("Завтра в 00:00 дом будет изъят, если не оплатите.");
  }

  try {
    Dialog.show(
      player,
      BANK_HOUSE_RENT_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Оплата дома",
      lines.join("\n"),
      "Далее",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть оплату дома.");
  }
}

function showDaysInputDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    player.sendClientMessage(Color.error, "У вас нет дома.");
    return;
  }

  const daily = dailyHouseRent(house.price);
  const bank = Math.max(0, Math.floor(account.bank));
  const body = [
    `Дом №${house.id}`,
    `Ежедневная плата: $${daily}`,
    `Банковский счёт: $${bank}`,
    "",
    "Введите количество дней:",
  ].join("\n");

  try {
    Dialog.show(
      player,
      BANK_HOUSE_RENT_DAYS_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Оплата дома",
      body,
      "Далее",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть ввод дней.");
  }
}

export function handleHouseRentDialog(
  player: Player,
  dialogId: number,
  ok: boolean,
  _listItem: number,
  inputText: string
): boolean {
  if (
    dialogId !== BANK_HOUSE_RENT_INFO_DIALOG_ID &&
    dialogId !== BANK_HOUSE_RENT_DAYS_DIALOG_ID &&
    dialogId !== BANK_HOUSE_RENT_CONFIRM_DIALOG_ID &&
    dialogId !== BANK_HOUSE_RENT_EMPTY_DIALOG_ID
  ) {
    return false;
  }

  if (dialogId === BANK_HOUSE_RENT_EMPTY_DIALOG_ID) {
    return true;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return true;
  }

  if (dialogId === BANK_HOUSE_RENT_INFO_DIALOG_ID) {
    if (!ok) {
      clearHouseRentPending(player);
      return true;
    }

    showDaysInputDialog(player);
    return true;
  }

  if (dialogId === BANK_HOUSE_RENT_DAYS_DIALOG_ID) {
    if (!ok) {
      clearHouseRentPending(player);
      showHouseRentMenu(player);
      return true;
    }

    const house = findOwnedHouse(account.id);
    if (!house) {
      player.sendClientMessage(Color.error, "У вас нет дома.");
      return true;
    }

    const days = parseRentDays(inputText);
    if (days === null) {
      player.sendClientMessage(Color.error, "Введите целое число дней от 1 до 999.");
      showDaysInputDialog(player);
      return true;
    }

    const amount = rentAmountForDays(house.price, days);
    const bank = Math.max(0, Math.floor(account.bank));
    if (amount > bank) {
      player.sendClientMessage(Color.error, "Недостаточно денег на банковском счёте.");
      showDaysInputDialog(player);
      return true;
    }

    const paidUntil = computePaidUntil(house.rentPaidUntil, days);
    pendingRent.set(slotId, {
      houseId: house.id,
      days,
      amount,
      paidUntil,
    });

    try {
      Dialog.show(
        player,
        BANK_HOUSE_RENT_CONFIRM_DIALOG_ID,
        DIALOG_STYLE_MSGBOX,
        "Подтверждение",
        [
          `Дом №${house.id}`,
          `Оплата: ${days} ${dayLabel(days)} — $${amount}`,
          `Новая дата оплаты: ${formatRentDate(paidUntil)}`,
          "",
          "Списание с банковского счёта.",
        ].join("\n"),
        "Оплатить",
        "Назад"
      );
    } catch {
      clearHouseRentPending(player);
      player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
    }
    return true;
  }

  if (!ok) {
    clearHouseRentPending(player);
    showDaysInputDialog(player);
    return true;
  }

  void confirmHouseRent(player);
  return true;
}

async function confirmHouseRent(player: Player): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const pending = pendingRent.get(slotId);
  if (!pending) {
    showHouseRentMenu(player);
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house || house.id !== pending.houseId) {
    clearHouseRentPending(player);
    player.sendClientMessage(Color.error, "У вас нет дома.");
    return;
  }

  if (payingRent.has(account.id)) {
    return;
  }

  payingRent.add(account.id);
  let result;
  try {
    result = await payHouseRent(account.id, house.id, pending.days);
  } catch (error: unknown) {
    payingRent.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] оплата дома ${house.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Оплата не прошла. Попробуйте ещё раз.");
    return;
  }
  payingRent.delete(account.id);
  clearHouseRentPending(player);

  if (!result.ok) {
    if (result.reason === "owner") {
      player.sendClientMessage(Color.error, "У вас нет дома.");
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

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  setHouseRentPaidUntil(house.id, result.paidUntil);

  patchAccount(player, { bank: result.bankLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  void saveUserMoney(account.id, account.money, result.bankLeft).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить банк ${account.name}: ${message}`);
  });

  player.sendClientMessage(
    Color.tryOk,
    `Дом №${house.id} оплачен на ${pending.days} ${dayLabel(pending.days)}. Оплачено до: ${formatRentDate(result.paidUntil)}.`
  );
  player.sendClientMessage(
    Color.info,
    `С банковского счёта списано $${result.amount}. Баланс: $${result.bankLeft}.`
  );
}

function parseRentDays(input: string): number | null {
  const raw = input.trim();
  if (!/^\d+$/.test(raw) || raw.length > 3) {
    return null;
  }

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_RENT_DAYS) {
    return null;
  }

  return days;
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
