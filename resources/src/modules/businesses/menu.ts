import { Dialog, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { findNearbyOwnedBusiness, isNearBusinessEntrance } from "./access";
import { refreshBusinessLabel } from "./markers";
import {
  clearBusinessForSale,
  findOwnedBusiness,
  getBusiness,
  sellBusinessToState,
  setBusinessOwner,
  transferBusinessToPlayer,
  type BusinessRecord,
} from "./repository";
import { dailyBusinessTax, formatRentDate } from "./tax-math";
import { businessTypeLabel } from "./types";

export const BIZ_MENU_DIALOG_ID = 75;
export const BIZ_STATS_DIALOG_ID = 76;
export const BIZ_SELL_STATE_DIALOG_ID = 77;
export const BIZ_SELL_PLAYER_INPUT_DIALOG_ID = 78;
export const BIZ_SELL_PLAYER_CONFIRM_DIALOG_ID = 79;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_LIST = 2;
const DIALOG_STYLE_INPUT = 1;
const MIN_BUY_LEVEL = 3;
const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 60_000;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

type PendingPlayerSale = {
  businessId: number;
  buyerSlot: number;
  buyerUserId: number;
  price: number;
};

type BizOffer = {
  sellerSlot: number;
  sellerUserId: number;
  businessId: number;
  price: number;
  expiresAt: number;
};

const pendingPlayerSale = new Map<number, PendingPlayerSale>();
const pendingOffers = new Map<number, BizOffer>();
const sellingState = new Set<number>();
const transferring = new Set<number>();

export function bindBusinessMenu(): void {
  registerCommand("biz", "Меню своего бизнеса у входа", (player) => {
    showBusinessMenu(player);
  });

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    handleBizDialog(
      player,
      Number(dialogId),
      Number(response) !== 0,
      Number(listItem),
      String(inputText ?? "")
    );
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const slot = playerId(player);
    if (slot === null || getYnOfferKind(slot) !== "biz") {
      return;
    }

    const offer = pendingOffers.get(slot);
    if (!offer) {
      releaseYnOffer(slot, "biz");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      pendingOffers.delete(slot);
      releaseYnOffer(slot, "biz");
      player.sendClientMessage(Color.error, "Предложение о покупке бизнеса истекло.");
      return;
    }

    if ((pressed & KEY_NO) !== 0) {
      refuseBizOffer(player, slot, offer);
      return;
    }

    if ((pressed & KEY_YES) !== 0) {
      void acceptBizOffer(player, slot, offer);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot !== null) {
      pendingPlayerSale.delete(slot);
      if (pendingOffers.has(slot)) {
        pendingOffers.delete(slot);
        releaseYnOffer(slot, "biz");
      }
      for (const [buyerSlot, offer] of pendingOffers) {
        if (offer.sellerSlot === slot) {
          pendingOffers.delete(buyerSlot);
          releaseYnOffer(buyerSlot, "biz");
        }
      }
    }

    const account = getAccount(player);
    if (account) {
      sellingState.delete(account.id);
      transferring.delete(account.id);
    }
  });
}

function showBusinessMenu(player: Player): void {
  const account = getAccount(player);
  if (!account || !isAuthenticated(player)) {
    return;
  }

  const business = findNearbyOwnedBusiness(player, account.id);
  if (!business) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу своего бизнеса.");
    return;
  }

  try {
    Dialog.show(
      player,
      BIZ_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `${TITLE}Меню бизнеса`,
      ["Статистика", "Продать бизнес", "Продать бизнес игроку"].join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть меню бизнеса.");
  }
}

function handleBizDialog(
  player: Player,
  dialogId: number,
  ok: boolean,
  listItem: number,
  inputText: string
): void {
  if (
    dialogId !== BIZ_MENU_DIALOG_ID &&
    dialogId !== BIZ_STATS_DIALOG_ID &&
    dialogId !== BIZ_SELL_STATE_DIALOG_ID &&
    dialogId !== BIZ_SELL_PLAYER_INPUT_DIALOG_ID &&
    dialogId !== BIZ_SELL_PLAYER_CONFIRM_DIALOG_ID
  ) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isAuthenticated(player)) {
    return;
  }

  if (dialogId === BIZ_MENU_DIALOG_ID) {
    if (!ok) {
      return;
    }

    const business = findNearbyOwnedBusiness(player, account.id);
    if (!business) {
      player.sendClientMessage(Color.error, "Подойдите к пикапу своего бизнеса.");
      return;
    }

    if (listItem === 0) {
      showBusinessStats(player, business);
      return;
    }
    if (listItem === 1) {
      showSellStateConfirm(player, business);
      return;
    }
    if (listItem === 2) {
      showSellPlayerInput(player, business);
      return;
    }

    showBusinessMenu(player);
    return;
  }

  if (dialogId === BIZ_STATS_DIALOG_ID) {
    if (ok) {
      showBusinessMenu(player);
    }
    return;
  }

  if (dialogId === BIZ_SELL_STATE_DIALOG_ID) {
    if (!ok) {
      showBusinessMenu(player);
      return;
    }
    void confirmSellToState(player);
    return;
  }

  if (dialogId === BIZ_SELL_PLAYER_INPUT_DIALOG_ID) {
    if (!ok) {
      pendingPlayerSale.delete(slotId);
      showBusinessMenu(player);
      return;
    }
    prepareSellToPlayer(player, inputText);
    return;
  }

  if (dialogId === BIZ_SELL_PLAYER_CONFIRM_DIALOG_ID) {
    if (!ok) {
      pendingPlayerSale.delete(slotId);
      showBusinessMenu(player);
      return;
    }
    sendSellOfferToPlayer(player);
  }
}

function showBusinessStats(player: Player, business: BusinessRecord): void {
  const daily = dailyBusinessTax(business.price);
  const body = [
    `${LABEL}Название:\t\t${VALUE}${business.name}`,
    `${LABEL}Номер:\t\t${VALUE}${business.id}`,
    `${LABEL}Тип:\t\t${VALUE}${businessTypeLabel(business.typeId)}`,
    `${LABEL}Стоимость:\t\t${VALUE}${formatMoney(business.price)}`,
    `${LABEL}Прибыль:\t\t${VALUE}${formatMoney(business.balance)}`,
    `${LABEL}Налог/день:\t\t${VALUE}${formatMoney(daily)}`,
    `${LABEL}Оплачено до:\t\t${VALUE}${formatRentDate(business.taxPaidUntil)}`,
    `${LABEL}Владелец:\t\t${VALUE}${business.ownerName ?? "—"}`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      BIZ_STATS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Статистика бизнеса`,
      body,
      "Назад",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть статистику.");
  }
}

function showSellStateConfirm(player: Player, business: BusinessRecord): void {
  try {
    Dialog.show(
      player,
      BIZ_SELL_STATE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Продажа бизнеса`,
      [
        `Вы хотите продать бизнес «${business.name}» (#${business.id}) государству?`,
        "",
        `Возврат: ${formatMoney(business.price)}`,
        "Прибыль бизнеса не будет возвращена.",
      ].join("\n"),
      "Продать",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть окно продажи.");
  }
}

function showSellPlayerInput(player: Player, business: BusinessRecord): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  pendingPlayerSale.set(slotId, {
    businessId: business.id,
    buyerSlot: -1,
    buyerUserId: -1,
    price: 0,
  });

  try {
    Dialog.show(
      player,
      BIZ_SELL_PLAYER_INPUT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      `${TITLE}Продажа игроку`,
      [
        `Бизнес: ${business.name} (#${business.id})`,
        "",
        "Введите ID игрока и цену через запятую.",
        "Пример: 2,150000",
      ].join("\n"),
      "Далее",
      "Назад"
    );
  } catch {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть ввод продажи.");
  }
}

function prepareSellToPlayer(player: Player, inputText: string): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const business = findNearbyOwnedBusiness(player, account.id);
  if (!business) {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(Color.error, "Подойдите к пикапу своего бизнеса.");
    return;
  }

  const parsed = parseSellPlayerInput(inputText);
  if (!parsed) {
    player.sendClientMessage(Color.error, "Формат: ID,цена — например 2,150000");
    showSellPlayerInput(player, business);
    return;
  }

  if (parsed.slot === slotId) {
    player.sendClientMessage(Color.error, "Нельзя продать бизнес себе.");
    showSellPlayerInput(player, business);
    return;
  }

  const buyer = omp.players.at(parsed.slot);
  const buyerAccount = buyer ? getAccount(buyer) : null;
  if (!buyer || !isPlayerActive(buyer) || !buyerAccount || !isAuthenticated(buyer)) {
    player.sendClientMessage(Color.error, "Игрок не в игре.");
    showSellPlayerInput(player, business);
    return;
  }

  if (!arePlayersNearby(player, buyer, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    showSellPlayerInput(player, business);
    return;
  }

  if (buyerAccount.level < MIN_BUY_LEVEL) {
    player.sendClientMessage(Color.error, "Покупателю нужен 3 уровень.");
    showSellPlayerInput(player, business);
    return;
  }

  if (!buyerAccount.passport) {
    player.sendClientMessage(Color.error, "У покупателя нет паспорта.");
    showSellPlayerInput(player, business);
    return;
  }

  if (findOwnedBusiness(buyerAccount.id)) {
    player.sendClientMessage(Color.error, "У игрока уже есть бизнес.");
    showSellPlayerInput(player, business);
    return;
  }

  if (buyerAccount.money < parsed.price) {
    player.sendClientMessage(Color.error, "У игрока недостаточно наличных.");
    showSellPlayerInput(player, business);
    return;
  }

  pendingPlayerSale.set(slotId, {
    businessId: business.id,
    buyerSlot: parsed.slot,
    buyerUserId: buyerAccount.id,
    price: parsed.price,
  });

  try {
    Dialog.show(
      player,
      BIZ_SELL_PLAYER_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Подтверждение`,
      [
        `Бизнес: ${business.name} (#${business.id})`,
        `Покупатель: ${playerName(buyer)}[${parsed.slot}]`,
        `Цена: ${formatMoney(parsed.price)}`,
        "",
        "Отправить предложение игроку?",
      ].join("\n"),
      "Отправить",
      "Отмена"
    );
  } catch {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
  }
}

function sendSellOfferToPlayer(player: Player): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const pending = pendingPlayerSale.get(slotId);
  pendingPlayerSale.delete(slotId);
  if (!pending || pending.buyerSlot < 0) {
    showBusinessMenu(player);
    return;
  }

  const business = findNearbyOwnedBusiness(player, account.id);
  if (!business || business.id !== pending.businessId) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу своего бизнеса.");
    return;
  }

  const buyer = omp.players.at(pending.buyerSlot);
  const buyerAccount = buyer ? getAccount(buyer) : null;
  if (
    !buyer ||
    !isPlayerActive(buyer) ||
    !buyerAccount ||
    buyerAccount.id !== pending.buyerUserId ||
    !isAuthenticated(buyer)
  ) {
    player.sendClientMessage(Color.error, "Игрок не в игре.");
    return;
  }

  if (!arePlayersNearby(player, buyer, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  const buyerSlot = playerId(buyer);
  if (buyerSlot === null) {
    return;
  }

  if (pendingOffers.has(buyerSlot) || !claimYnOffer(buyerSlot, "biz")) {
    player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  pendingOffers.set(buyerSlot, {
    sellerSlot: slotId,
    sellerUserId: account.id,
    businessId: business.id,
    price: pending.price,
    expiresAt: Date.now() + OFFER_TTL_MS,
  });

  player.sendClientMessage(
    Color.info,
    `Вы предложили бизнес «${business.name}» игроку ${playerName(buyer)} за ${formatMoney(pending.price)}.`
  );
  buyer.sendClientMessage(
    Color.white,
    `${playerName(player)} предлагает купить бизнес «${business.name}» (#${business.id}) за ${formatMoney(pending.price)}.`
  );
  buyer.sendClientMessage(
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы купить или {FF6600}N {FFFFFF}для отказа"
  );
}

async function confirmSellToState(player: Player): Promise<void> {
  const account = getAccount(player);
  if (!account || !isPlayerActive(player)) {
    return;
  }

  const business = findNearbyOwnedBusiness(player, account.id);
  if (!business) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу своего бизнеса.");
    return;
  }

  if (sellingState.has(account.id)) {
    return;
  }

  sellingState.add(account.id);
  let result;
  try {
    result = await sellBusinessToState(business.id, account.id);
  } catch (error: unknown) {
    sellingState.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] продажа бизнеса ${business.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }
  sellingState.delete(account.id);

  if (!result.ok) {
    if (result.reason === "owner") {
      player.sendClientMessage(Color.error, "У вас нет этого бизнеса.");
      return;
    }
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  const cleared = clearBusinessForSale(business.id);
  if (!cleared) {
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  void saveUserMoney(account.id, result.cashLeft, account.bank).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить деньги ${account.name}: ${message}`);
  });

  refreshBusinessLabel(business.id);
  player.sendClientMessage(
    Color.info,
    `Вы продали бизнес «${business.name}» (#${business.id}) государству за ${formatMoney(result.price)}.`
  );
}

async function acceptBizOffer(
  buyer: Player,
  buyerSlot: number,
  offer: BizOffer
): Promise<void> {
  pendingOffers.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "biz");

  const buyerAccount = getAccount(buyer);
  if (!buyerAccount || !isAuthenticated(buyer)) {
    return;
  }

  if (buyerAccount.level < MIN_BUY_LEVEL) {
    buyer.sendClientMessage(Color.error, "Купить бизнес можно с 3 уровня.");
    return;
  }

  if (!buyerAccount.passport) {
    buyer.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  if (findOwnedBusiness(buyerAccount.id)) {
    buyer.sendClientMessage(Color.error, "У вас уже есть бизнес.");
    return;
  }

  const seller = omp.players.at(offer.sellerSlot);
  const sellerAccount = seller ? getAccount(seller) : null;
  if (
    !seller ||
    !isPlayerActive(seller) ||
    !sellerAccount ||
    sellerAccount.id !== offer.sellerUserId ||
    !isAuthenticated(seller)
  ) {
    buyer.sendClientMessage(Color.error, "Продавец вышел из игры. Сделка отменена.");
    return;
  }

  if (!arePlayersNearby(buyer, seller, WHISPER_RADIUS)) {
    buyer.sendClientMessage(Color.error, "Продавец слишком далеко. Сделка отменена.");
    seller.sendClientMessage(Color.error, "Покупатель слишком далеко. Сделка отменена.");
    return;
  }

  if (!isNearBusinessEntrance(seller, offer.businessId)) {
    buyer.sendClientMessage(Color.error, "Продавец должен быть у бизнеса. Сделка отменена.");
    seller.sendClientMessage(Color.error, "Подойдите к пикапу бизнеса.");
    return;
  }

  const business = getBusiness(offer.businessId);
  if (!business || business.ownerId !== sellerAccount.id) {
    buyer.sendClientMessage(Color.error, "Бизнес больше не принадлежит продавцу.");
    return;
  }

  if (buyerAccount.money < offer.price) {
    buyer.sendClientMessage(Color.error, "Недостаточно наличных.");
    seller.sendClientMessage(
      Color.error,
      `${playerName(buyer)} не смог оплатить бизнес (${formatMoney(offer.price)}).`
    );
    return;
  }

  if (transferring.has(sellerAccount.id) || transferring.has(buyerAccount.id)) {
    return;
  }

  transferring.add(sellerAccount.id);
  transferring.add(buyerAccount.id);

  let result;
  try {
    result = await transferBusinessToPlayer(
      offer.businessId,
      sellerAccount.id,
      buyerAccount.id,
      offer.price
    );
  } catch (error: unknown) {
    transferring.delete(sellerAccount.id);
    transferring.delete(buyerAccount.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] передача бизнеса ${offer.businessId}: ${message}`);
    buyer.sendClientMessage(Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  }

  transferring.delete(sellerAccount.id);
  transferring.delete(buyerAccount.id);

  if (!result.ok) {
    if (result.reason === "buyer_owned") {
      buyer.sendClientMessage(Color.error, "У вас уже есть бизнес.");
      return;
    }
    if (result.reason === "buyer_funds") {
      buyer.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }
    if (result.reason === "owner") {
      buyer.sendClientMessage(Color.error, "Бизнес больше не принадлежит продавцу.");
      return;
    }
    buyer.sendClientMessage(Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  }

  const owned = setBusinessOwner(offer.businessId, buyerAccount.id, buyerAccount.name);
  if (!owned) {
    buyer.sendClientMessage(Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  }

  if (isPlayerActive(buyer) && getAccount(buyer)?.id === buyerAccount.id) {
    patchAccount(buyer, { money: result.buyerCashLeft });
    const liveBuyer = getAccount(buyer);
    if (liveBuyer) {
      applyWallet(buyer, liveBuyer);
    }
    void saveUserMoney(buyerAccount.id, result.buyerCashLeft, buyerAccount.bank).catch(() => {
      // Кэш уже обновлён.
    });
    buyer.sendClientMessage(
      Color.info,
      `Вы купили бизнес «${owned.name}» (#${owned.id}) за ${formatMoney(offer.price)}.`
    );
  }

  if (isPlayerActive(seller) && getAccount(seller)?.id === sellerAccount.id) {
    patchAccount(seller, { money: result.sellerCashLeft });
    const liveSeller = getAccount(seller);
    if (liveSeller) {
      applyWallet(seller, liveSeller);
    }
    void saveUserMoney(sellerAccount.id, result.sellerCashLeft, sellerAccount.bank).catch(() => {
      // Кэш уже обновлён.
    });
    seller.sendClientMessage(
      Color.info,
      `Игрок ${playerName(buyer)} купил ваш бизнес «${owned.name}» за ${formatMoney(offer.price)}.`
    );
  }

  refreshBusinessLabel(offer.businessId);
}

function refuseBizOffer(buyer: Player, buyerSlot: number, offer: BizOffer): void {
  pendingOffers.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "biz");
  buyer.sendClientMessage(Color.gray, "Вы отказались от покупки бизнеса.");

  const seller = omp.players.at(offer.sellerSlot);
  if (seller && isPlayerActive(seller)) {
    seller.sendClientMessage(
      Color.gray,
      `${playerName(buyer)} отказался от покупки бизнеса.`
    );
  }
}

function parseSellPlayerInput(input: string): { slot: number; price: number } | null {
  const match = input.trim().match(/^(\d+)\s*[, ]\s*(\d+)$/);
  if (!match) {
    return null;
  }

  const slot = Number(match[1]);
  const price = Number(match[2]);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(price) || price < 1) {
    return null;
  }

  return { slot, price };
}
