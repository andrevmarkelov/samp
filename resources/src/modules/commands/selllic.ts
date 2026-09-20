import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { byGender } from "../auth/gender";
import { saveLicenseSale } from "../auth/repository";
import {
  findLicense,
  missingLicenses,
  type LicenseDef,
  type LicenseKey,
} from "../auth/licenses";
import {
  applyWallet,
  getAccount,
  patchAccount,
} from "../auth/session";
import { AUTOSCHOOL_INTERIOR, ORG_AUTOSCHOOL_ID } from "../org/autoschool";
import { getMembership } from "../org";
import { STREET_WORLD } from "../spawn/point";
import { registerCommand } from "./registry";

export const SELL_LIC_LIST_DIALOG_ID = 29;
export const SELL_LIC_PRICE_DIALOG_ID = 30;
export const SELL_LIC_OFFER_DIALOG_ID = 31;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_LIST = 2;
const DESK = { x: -2031.8607, y: -116.9832, z: 1035.1719 };
const DESK_RADIUS = 8;
const BUYER_RADIUS = 10;
const OFFER_TTL_MS = 60_000;
const MAX_MONEY = 2_147_483_647;
const PLAYER_STATE_ONFOOT = 1;

type PendingSelect = {
  targetSlot: number;
  targetAccountId: number;
  options: LicenseKey[];
};

type PendingOffer = {
  sellerSlot: number;
  sellerAccountId: number;
  buyerSlot: number;
  buyerAccountId: number;
  license: LicenseKey;
  price: number;
  timer: ReturnType<typeof setTimeout>;
};

const pendingSelect = new Map<number, PendingSelect>();
const pendingOfferByBuyer = new Map<number, PendingOffer>();
const busy = new Set<number>();

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}

function findPlayer(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    return null;
  }

  try {
    if (target.isNPC()) {
      return null;
    }
  } catch {
    return null;
  }

  return getAccount(target) ? target : null;
}

function isAutoschoolStaff(player: Player): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  return membership?.org.id === ORG_AUTOSCHOOL_ID;
}

function atLicenseDesk(player: Player): boolean {
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }

    if (player.getVirtualWorld() !== STREET_WORLD) {
      return false;
    }

    if (player.getInterior() !== AUTOSCHOOL_INTERIOR) {
      return false;
    }

    return player.getDistanceFromPoint(DESK.x, DESK.y, DESK.z) <= DESK_RADIUS;
  } catch {
    return false;
  }
}

function saleReady(seller: Player, buyer: Player): string | null {
  if (!isAutoschoolStaff(seller)) {
    return "Команда доступна сотрудникам автошколы.";
  }

  if (!atLicenseDesk(seller)) {
    return "Продать лицензию можно только у стойки в автошколе.";
  }

  if (!arePlayersNearby(seller, buyer, BUYER_RADIUS)) {
    return "Игрок слишком далеко.";
  }

  const sellerAccount = getAccount(seller);
  const buyerAccount = getAccount(buyer);
  if (sellerAccount?.hospitalized) {
    return "Вам нужно лечение. Займите койку: /hospital.";
  }

  if (buyerAccount?.hospitalized) {
    return "Игроку нужно лечение.";
  }

  return null;
}

function clearSellerSelect(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingSelect.delete(id);
  }
}

function clearBuyerOffer(player: Player, notify: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const offer = pendingOfferByBuyer.get(id);
  if (!offer) {
    return;
  }

  clearTimeout(offer.timer);
  pendingOfferByBuyer.delete(id);

  if (!notify) {
    return;
  }

  const buyer = findPlayer(offer.buyerSlot);
  if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
    tell(buyer, Color.error, "Предложение лицензии отменено.");
  }

  const seller = findPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tell(seller, Color.info, "Предложение лицензии отменено.");
  }
}

function expireOffer(buyerSlot: number, buyerAccountId: number): void {
  const offer = pendingOfferByBuyer.get(buyerSlot);
  if (!offer || offer.buyerAccountId !== buyerAccountId) {
    return;
  }

  pendingOfferByBuyer.delete(buyerSlot);

  const buyer = findPlayer(buyerSlot);
  if (buyer && getAccount(buyer)?.id === buyerAccountId) {
    tell(buyer, Color.error, "Предложение лицензии истекло.");
  }

  const seller = findPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tell(seller, Color.error, "Предложение лицензии истекло.");
  }
}

function cancelOffersFromSeller(sellerSlot: number, sellerAccountId?: number): void {
  for (const [buyerSlot, offer] of pendingOfferByBuyer) {
    if (offer.sellerSlot !== sellerSlot) {
      continue;
    }

    if (sellerAccountId !== undefined && offer.sellerAccountId !== sellerAccountId) {
      continue;
    }

    clearTimeout(offer.timer);
    pendingOfferByBuyer.delete(buyerSlot);

    const buyer = findPlayer(buyerSlot);
    if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
      tell(buyer, Color.error, "Предложение лицензии отменено.");
    }
  }
}

function showLicenseList(seller: Player, options: LicenseDef[]): boolean {
  try {
    Dialog.show(
      seller,
      SELL_LIC_LIST_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Продажа лицензии",
      options.map((row) => row.label).join("\n"),
      "Далее",
      "Отмена"
    );
    return true;
  } catch {
    tell(seller, Color.error, "Не удалось открыть список лицензий.");
    return false;
  }
}

function showPriceDialog(seller: Player, license: LicenseDef): boolean {
  try {
    Dialog.show(
      seller,
      SELL_LIC_PRICE_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Цена лицензии",
      `Лицензия: ${license.label}\nДиапазон: $${license.min} - $${license.max}`,
      "Предложить",
      "Отмена"
    );
    return true;
  } catch {
    tell(seller, Color.error, "Не удалось открыть окно цены.");
    return false;
  }
}

function parsePrice(raw: string, license: LicenseDef): number | null {
  const text = raw.trim().replace(/[$\s]/g, "");
  const amount = Number(text);
  if (!Number.isInteger(amount) || amount < license.min || amount > license.max) {
    return null;
  }

  return amount;
}

registerCommand("selllic", "Продать лицензию ученику", (player, args) => {
  if (!isAutoschoolStaff(player)) {
    tell(player, Color.error, "Команда доступна сотрудникам автошколы.");
    return;
  }

  const rawId = args.trim();
  const slot = Number(rawId);
  if (!rawId || !Number.isInteger(slot) || slot < 0) {
    tell(player, Color.error, "Использование: /selllic [id]");
    return;
  }

  const target = findPlayer(slot);
  if (!target) {
    tell(player, Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    tell(player, Color.error, "Нельзя продать лицензию себе.");
    return;
  }

  const blocked = saleReady(player, target);
  if (blocked) {
    tell(player, Color.error, blocked);
    return;
  }

  const targetAccount = getAccount(target);
  const sellerId = playerId(player);
  if (!targetAccount || sellerId === null) {
    return;
  }

  const options = missingLicenses(targetAccount.licenses);
  if (options.length === 0) {
    tell(player, Color.error, "У игрока уже есть все лицензии.");
    return;
  }

  const sellerAccount = getAccount(player);
  if (sellerAccount) {
    cancelOffersFromSeller(sellerId, sellerAccount.id);
  }

  clearBuyerOffer(target, true);
  pendingSelect.set(sellerId, {
    targetSlot: slot,
    targetAccountId: targetAccount.id,
    options: options.map((row) => row.key),
  });

  if (!showLicenseList(player, options)) {
    pendingSelect.delete(sellerId);
  }
});

export function bindSellLic(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (
      id !== SELL_LIC_LIST_DIALOG_ID &&
      id !== SELL_LIC_PRICE_DIALOG_ID &&
      id !== SELL_LIC_OFFER_DIALOG_ID
    ) {
      return;
    }

    if (id === SELL_LIC_LIST_DIALOG_ID) {
      onLicensePicked(player, Number(response), Number(listItem), String(inputText ?? ""));
      return;
    }

    if (id === SELL_LIC_PRICE_DIALOG_ID) {
      onPriceEntered(player, Number(response), String(inputText ?? ""));
      return;
    }

    onOfferAnswer(player, Number(response));
  });

  omp.on("playerConnect", (player) => {
    clearSellerSelect(player);
    clearBuyerOffer(player, false);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    clearSellerSelect(player);
    clearBuyerOffer(player, true);

    if (id !== null) {
      cancelOffersFromSeller(id);
    }
  });
}

function onLicensePicked(
  seller: Player,
  response: number,
  listItem: number,
  inputText: string
): void {
  const sellerId = playerId(seller);
  const pending = sellerId === null ? undefined : pendingSelect.get(sellerId);

  if (response === 0) {
    if (sellerId !== null) {
      pendingSelect.delete(sellerId);
    }
    return;
  }

  if (sellerId === null || !pending) {
    return;
  }

  const target = findPlayer(pending.targetSlot);
  if (!target || getAccount(target)?.id !== pending.targetAccountId) {
    pendingSelect.delete(sellerId);
    tell(seller, Color.error, "Игрок не найден.");
    return;
  }

  const blocked = saleReady(seller, target);
  if (blocked) {
    pendingSelect.delete(sellerId);
    tell(seller, Color.error, blocked);
    return;
  }

  const live = getAccount(target);
  if (!live) {
    pendingSelect.delete(sellerId);
    return;
  }

  let key = pending.options[listItem];
  const typed = inputText.trim().toLowerCase();
  if (typed) {
    const byLabel = missingLicenses(live.licenses).find(
      (row) => row.label.toLowerCase() === typed
    );
    if (byLabel) {
      key = byLabel.key;
    }
  }

  const license = key ? findLicense(key) : null;
  if (!license || live.licenses[license.key]) {
    pendingSelect.delete(sellerId);
    tell(seller, Color.error, "Эту лицензию нельзя продать этому игроку.");
    return;
  }

  pendingSelect.set(sellerId, {
    ...pending,
    options: [license.key],
  });

  if (!showPriceDialog(seller, license)) {
    pendingSelect.delete(sellerId);
  }
}

function onPriceEntered(seller: Player, response: number, inputText: string): void {
  const sellerId = playerId(seller);
  const pending = sellerId === null ? undefined : pendingSelect.get(sellerId);
  if (sellerId !== null) {
    pendingSelect.delete(sellerId);
  }

  if (response === 0 || !pending) {
    return;
  }

  const key = pending.options[0];
  const license = key ? findLicense(key) : null;
  if (!license) {
    return;
  }

  const target = findPlayer(pending.targetSlot);
  if (!target || getAccount(target)?.id !== pending.targetAccountId) {
    tell(seller, Color.error, "Игрок не найден.");
    return;
  }

  const blocked = saleReady(seller, target);
  if (blocked) {
    tell(seller, Color.error, blocked);
    return;
  }

  const live = getAccount(target);
  if (!live || live.licenses[license.key]) {
    tell(seller, Color.error, "У игрока уже есть эта лицензия.");
    return;
  }

  const price = parsePrice(inputText, license);
  if (price === null) {
    tell(
      seller,
      Color.error,
      `Цена ${license.label}: $${license.min} - $${license.max}.`
    );
    if (sellerId !== null) {
      pendingSelect.set(sellerId, pending);
      showPriceDialog(seller, license);
    }
    return;
  }

  const buyerId = playerId(target);
  const sellerAccount = getAccount(seller);
  if (sellerId === null || buyerId === null || !sellerAccount) {
    return;
  }

  cancelOffersFromSeller(sellerId, sellerAccount.id);
  clearBuyerOffer(target, true);

  const offer: PendingOffer = {
    sellerSlot: sellerId,
    sellerAccountId: sellerAccount.id,
    buyerSlot: buyerId,
    buyerAccountId: live.id,
    license: license.key,
    price,
    timer: setTimeout(() => {
      expireOffer(buyerId, live.id);
    }, OFFER_TTL_MS),
  };
  pendingOfferByBuyer.set(buyerId, offer);

  try {
    Dialog.show(
      target,
      SELL_LIC_OFFER_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Покупка лицензии",
      `Сотрудник ${sellerAccount.name} предлагает вам купить лицензию ${license.offer} за $${price}.`,
      "Согласиться",
      "Отказаться"
    );
  } catch {
    clearTimeout(offer.timer);
    pendingOfferByBuyer.delete(buyerId);
    tell(seller, Color.error, "Не удалось отправить предложение.");
    return;
  }

  tell(
    seller,
    Color.info,
    `Вы предложили ${playerChatName(target)} лицензию ${license.label} за $${price}.`
  );
}

function onOfferAnswer(buyer: Player, response: number): void {
  const buyerId = playerId(buyer);
  const offer = buyerId === null ? undefined : pendingOfferByBuyer.get(buyerId);
  if (buyerId !== null) {
    pendingOfferByBuyer.delete(buyerId);
  }

  if (!offer) {
    tell(buyer, Color.error, "Предложение уже неактуально.");
    return;
  }

  clearTimeout(offer.timer);

  const seller = findPlayer(offer.sellerSlot);
  const sellerOk =
    !!seller && getAccount(seller)?.id === offer.sellerAccountId && isPlayerActive(seller);
  const license = findLicense(offer.license);
  const buyerTag = playerChatName(buyer);

  if (response === 0) {
    tell(buyer, Color.info, "Вы отклонили предложение.");
    if (sellerOk && seller) {
      const verb = byGender(
        getAccount(buyer)?.gender ?? null,
        "отклонил",
        "отклонила"
      );
      tell(seller, Color.info, `${buyerTag} ${verb} предложение лицензии.`);
    }
    return;
  }

  if (!sellerOk || !seller || !license) {
    tell(buyer, Color.error, "Предложение уже неактуально.");
    return;
  }

  const blocked = saleReady(seller, buyer);
  if (blocked) {
    tell(buyer, Color.error, blocked);
    tell(seller, Color.error, blocked);
    return;
  }

  void completeSale(seller, buyer, license, offer.price);
}

async function completeSale(
  seller: Player,
  buyer: Player,
  license: LicenseDef,
  price: number
): Promise<void> {
  const sellerAccount = getAccount(seller);
  const buyerAccount = getAccount(buyer);
  if (!sellerAccount || !buyerAccount) {
    return;
  }

  if (busy.has(sellerAccount.id) || busy.has(buyerAccount.id)) {
    tell(seller, Color.error, "Подождите, идёт другая операция.");
    tell(buyer, Color.error, "Подождите, идёт другая операция.");
    return;
  }

  if (buyerAccount.licenses[license.key]) {
    tell(seller, Color.error, "У игрока уже есть эта лицензия.");
    tell(buyer, Color.error, "У вас уже есть эта лицензия.");
    return;
  }

  const sellerCash = Math.max(0, Math.floor(sellerAccount.money));
  const buyerCash = Math.max(0, Math.floor(buyerAccount.money));
  if (buyerCash < price) {
    tell(buyer, Color.error, "Недостаточно наличных.");
    tell(seller, Color.error, "У игрока недостаточно наличных.");
    return;
  }

  if (sellerCash > MAX_MONEY - price) {
    tell(seller, Color.error, "Вы не можете принять столько наличных.");
    tell(buyer, Color.error, "Сотрудник не может принять оплату.");
    return;
  }

  const nextSellerCash = sellerCash + price;
  const nextBuyerCash = buyerCash - price;
  const nextLicenses = { ...buyerAccount.licenses, [license.key]: true };

  busy.add(sellerAccount.id);
  busy.add(buyerAccount.id);
  try {
    await saveLicenseSale({
      sellerId: sellerAccount.id,
      sellerCash: nextSellerCash,
      sellerBank: sellerAccount.bank,
      buyerId: buyerAccount.id,
      buyerCash: nextBuyerCash,
      buyerBank: buyerAccount.bank,
      buyerLicenses: nextLicenses,
    });
  } catch (error: unknown) {
    busy.delete(sellerAccount.id);
    busy.delete(buyerAccount.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] selllic ${sellerAccount.name}: ${message}`);
    tell(seller, Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    tell(buyer, Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  }

  busy.delete(sellerAccount.id);
  busy.delete(buyerAccount.id);

  if (isPlayerActive(seller) && getAccount(seller)?.id === sellerAccount.id) {
    patchAccount(seller, { money: nextSellerCash });
    const liveSeller = getAccount(seller);
    if (liveSeller) {
      applyWallet(seller, liveSeller);
    }
    tell(
      seller,
      Color.info,
      `Вы продали ${playerChatName(buyer)} лицензию ${license.label} за $${price}.`
    );
  }

  if (isPlayerActive(buyer) && getAccount(buyer)?.id === buyerAccount.id) {
    patchAccount(buyer, { money: nextBuyerCash, licenses: nextLicenses });
    const liveBuyer = getAccount(buyer);
    if (liveBuyer) {
      applyWallet(buyer, liveBuyer);
    }
    tell(buyer, Color.info, `Вы купили лицензию ${license.offer} за $${price}.`);
  }
}
