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
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { findOwnedHouse } from "../houses/repository";
import { requiredDriveLicense } from "./drive-license";
import {
  destroyPersonalVehicleByDbId,
  findOwnedPersonalVehicleNear,
  findRuntimeIdByDbId,
  getPersonalRuntime,
  isPlayerNearPersonalVehicle,
  setPersonalOwner,
} from "./personal";
import {
  STATE_SELL_REFUND_RATE,
  findOwnedPlayerVehicle,
  sellPlayerVehicleToState,
  stateSellRefund,
  transferPlayerVehicleSale,
  type PlayerVehicleRecord,
} from "./player-vehicles";

export const CAR_SELL_STATE_DIALOG_ID = 90;
export const CAR_SELL_PLAYER_INPUT_DIALOG_ID = 91;
export const CAR_SELL_PLAYER_CONFIRM_DIALOG_ID = 92;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 60_000;
const TITLE = "{FFCC00}";

type PendingPlayerSale = {
  vehicleId: number;
  runtimeId: number;
  buyerSlot: number;
  buyerUserId: number;
  price: number;
};

type CarOffer = {
  sellerSlot: number;
  sellerUserId: number;
  vehicleId: number;
  runtimeId: number;
  price: number;
  expiresAt: number;
};

const pendingPlayerSale = new Map<number, PendingPlayerSale>();
const pendingOffers = new Map<number, CarOffer>();
const sellingState = new Set<number>();
/** vehicleId → идёт передача игроку. */
const transferring = new Set<number>();

export function bindPersonalVehicleSell(): void {
  omp.on("dialogResponse", (player, dialogId, response, _listItem, inputText) => {
    handleSellDialog(
      player,
      Number(dialogId),
      Number(response) !== 0,
      String(inputText ?? "")
    );
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const slot = playerId(player);
    if (slot === null || getYnOfferKind(slot) !== "car") {
      return;
    }

    const offer = pendingOffers.get(slot);
    if (!offer) {
      releaseYnOffer(slot, "car");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      pendingOffers.delete(slot);
      releaseYnOffer(slot, "car");
      player.sendClientMessage(Color.error, "Предложение о покупке транспорта истекло.");
      return;
    }

    if ((pressed & KEY_NO) !== 0) {
      refuseCarOffer(player, slot, offer);
      return;
    }

    if ((pressed & KEY_YES) !== 0) {
      void acceptCarOffer(player, slot, offer);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot !== null) {
      pendingPlayerSale.delete(slot);
      if (pendingOffers.has(slot)) {
        pendingOffers.delete(slot);
        releaseYnOffer(slot, "car");
      }
      for (const [buyerSlot, offer] of pendingOffers) {
        if (offer.sellerSlot === slot) {
          pendingOffers.delete(buyerSlot);
          releaseYnOffer(buyerSlot, "car");
          transferring.delete(offer.vehicleId);
        }
      }
    }

    const account = getAccount(player);
    if (account) {
      sellingState.delete(account.id);
    }
  });
}

export function showSellStateConfirm(
  player: Player,
  vehicle: PlayerVehicleRecord
): void {
  const refund = stateSellRefund(vehicle.purchasePrice);
  const refundPct = Math.round(STATE_SELL_REFUND_RATE * 100);
  try {
    Dialog.show(
      player,
      CAR_SELL_STATE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Продажа транспорта`,
      [
        `Вы хотите продать транспорт #${vehicle.id} (модель ${vehicle.modelId})?`,
        "",
        `Цена покупки: ${formatMoney(vehicle.purchasePrice)}`,
        `Возврат: ${formatMoney(refund)} (${refundPct}%)`,
        "",
        "Машина будет удалена безвозвратно.",
      ].join("\n"),
      "Продать",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть окно продажи.");
  }
}

export function showSellPlayerInput(
  player: Player,
  vehicle: PlayerVehicleRecord
): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const near = findOwnedPersonalVehicleNear(player, account.id);
  if (!near) {
    player.sendClientMessage(
      Color.error,
      "Для продажи игроку подойдите к своему транспорту или сядьте в него."
    );
    return;
  }

  let runtimeId: number | null = null;
  try {
    runtimeId = near.getID();
  } catch {
    return;
  }
  if (runtimeId === null || runtimeId < 1) {
    return;
  }

  const personal = getPersonalRuntime(runtimeId);
  if (!personal || personal.dbId !== vehicle.id) {
    player.sendClientMessage(
      Color.error,
      "Для продажи игроку подойдите к своему транспорту или сядьте в него."
    );
    return;
  }

  pendingPlayerSale.set(slotId, {
    vehicleId: vehicle.id,
    runtimeId,
    buyerSlot: -1,
    buyerUserId: -1,
    price: 0,
  });

  try {
    Dialog.show(
      player,
      CAR_SELL_PLAYER_INPUT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      `${TITLE}Продажа игроку`,
      [
        `Транспорт #${vehicle.id} (модель ${vehicle.modelId})`,
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

function handleSellDialog(
  player: Player,
  dialogId: number,
  ok: boolean,
  inputText: string
): void {
  if (
    dialogId !== CAR_SELL_STATE_DIALOG_ID &&
    dialogId !== CAR_SELL_PLAYER_INPUT_DIALOG_ID &&
    dialogId !== CAR_SELL_PLAYER_CONFIRM_DIALOG_ID
  ) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isAuthenticated(player)) {
    return;
  }

  if (dialogId === CAR_SELL_STATE_DIALOG_ID) {
    if (!ok) {
      return;
    }
    void confirmSellToState(player);
    return;
  }

  if (dialogId === CAR_SELL_PLAYER_INPUT_DIALOG_ID) {
    if (!ok) {
      pendingPlayerSale.delete(slotId);
      return;
    }
    void prepareSellToPlayer(player, inputText);
    return;
  }

  if (dialogId === CAR_SELL_PLAYER_CONFIRM_DIALOG_ID) {
    if (!ok) {
      pendingPlayerSale.delete(slotId);
      return;
    }
    sendSellOfferToPlayer(player);
  }
}

async function confirmSellToState(player: Player): Promise<void> {
  const account = getAccount(player);
  if (!account || !isPlayerActive(player)) {
    return;
  }

  if (sellingState.has(account.id)) {
    return;
  }

  const vehicle = await findOwnedPlayerVehicle(account.id);
  if (!vehicle) {
    player.sendClientMessage(Color.error, "У вас нет личного транспорта.");
    return;
  }

  sellingState.add(account.id);
  let result;
  try {
    result = await sellPlayerVehicleToState(vehicle.id, account.id);
  } catch (error: unknown) {
    sellingState.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] продажа ТС ${vehicle.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }
  sellingState.delete(account.id);

  if (!result.ok) {
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }

  destroyPersonalVehicleByDbId(vehicle.id, false);

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  player.sendClientMessage(
    Color.info,
    `Вы продали транспорт #${vehicle.id} за ${formatMoney(result.refund)}.`
  );
}

async function prepareSellToPlayer(player: Player, inputText: string): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const vehicle = await findOwnedPlayerVehicle(account.id);
  if (!vehicle) {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(Color.error, "У вас нет личного транспорта.");
    return;
  }

  const near = findOwnedPersonalVehicleNear(player, account.id);
  if (!near) {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(
      Color.error,
      "Для продажи игроку подойдите к своему транспорту или сядьте в него."
    );
    return;
  }

  let runtimeId: number | null = null;
  try {
    runtimeId = near.getID();
  } catch {
    pendingPlayerSale.delete(slotId);
    return;
  }
  if (runtimeId === null || runtimeId < 1) {
    pendingPlayerSale.delete(slotId);
    return;
  }

  const personal = getPersonalRuntime(runtimeId);
  if (!personal || personal.dbId !== vehicle.id) {
    pendingPlayerSale.delete(slotId);
    player.sendClientMessage(
      Color.error,
      "Для продажи игроку подойдите к своему транспорту или сядьте в него."
    );
    return;
  }

  const parsed = parseSellPlayerInput(inputText);
  if (!parsed) {
    player.sendClientMessage(Color.error, "Формат: ID,цена — например 2,150000");
    showSellPlayerInput(player, vehicle);
    return;
  }

  if (parsed.slot === slotId) {
    player.sendClientMessage(Color.error, "Нельзя продать транспорт себе.");
    showSellPlayerInput(player, vehicle);
    return;
  }

  const buyer = omp.players.at(parsed.slot);
  const buyerAccount = buyer ? getAccount(buyer) : null;
  if (!buyer || !isPlayerActive(buyer) || !buyerAccount || !isAuthenticated(buyer)) {
    player.sendClientMessage(Color.error, "Игрок не в игре.");
    showSellPlayerInput(player, vehicle);
    return;
  }

  if (!arePlayersNearby(player, buyer, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    showSellPlayerInput(player, vehicle);
    return;
  }

  if (!isPlayerNearPersonalVehicle(buyer, runtimeId)) {
    player.sendClientMessage(
      Color.error,
      "Покупатель должен быть в машине или рядом с ней."
    );
    showSellPlayerInput(player, vehicle);
    return;
  }

  const buyerCheck = await buyerCanPurchaseVehicle(buyer, vehicle.modelId);
  if (buyerCheck) {
    player.sendClientMessage(Color.error, buyerCheck);
    showSellPlayerInput(player, vehicle);
    return;
  }

  if (buyerAccount.money < parsed.price) {
    player.sendClientMessage(Color.error, "У игрока недостаточно наличных.");
    showSellPlayerInput(player, vehicle);
    return;
  }

  pendingPlayerSale.set(slotId, {
    vehicleId: vehicle.id,
    runtimeId,
    buyerSlot: parsed.slot,
    buyerUserId: buyerAccount.id,
    price: parsed.price,
  });

  try {
    Dialog.show(
      player,
      CAR_SELL_PLAYER_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Подтверждение`,
      [
        `Транспорт #${vehicle.id} (модель ${vehicle.modelId})`,
        `Покупатель: ${playerName(buyer)}[${parsed.slot}]`,
        `Цена: ${formatMoney(parsed.price)}`,
        "",
        "Действительно хотите продать этот транспорт игроку?",
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
    return;
  }

  if (!isPlayerNearPersonalVehicle(player, pending.runtimeId)) {
    player.sendClientMessage(
      Color.error,
      "Подойдите к своему транспорту или сядьте в него."
    );
    return;
  }

  const personal = getPersonalRuntime(pending.runtimeId);
  if (!personal || personal.dbId !== pending.vehicleId || personal.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Это уже не ваш транспорт.");
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

  if (!isPlayerNearPersonalVehicle(buyer, pending.runtimeId)) {
    player.sendClientMessage(
      Color.error,
      "Покупатель должен быть в машине или рядом с ней."
    );
    return;
  }

  const buyerSlot = playerId(buyer);
  if (buyerSlot === null) {
    return;
  }

  if (pendingOffers.has(buyerSlot) || !claimYnOffer(buyerSlot, "car")) {
    player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  pendingOffers.set(buyerSlot, {
    sellerSlot: slotId,
    sellerUserId: account.id,
    vehicleId: pending.vehicleId,
    runtimeId: pending.runtimeId,
    price: pending.price,
    expiresAt: Date.now() + OFFER_TTL_MS,
  });

  player.sendClientMessage(
    Color.info,
    `Вы предложили транспорт #${pending.vehicleId} игроку ${playerName(buyer)} за ${formatMoney(pending.price)}.`
  );
  buyer.sendClientMessage(
    Color.white,
    `${playerName(player)} предлагает купить транспорт #${pending.vehicleId} за ${formatMoney(pending.price)}.`
  );
  buyer.sendClientMessage(
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы купить или {FF6600}N {FFFFFF}для отказа"
  );
}

async function acceptCarOffer(
  buyer: Player,
  buyerSlot: number,
  offer: CarOffer
): Promise<void> {
  pendingOffers.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "car");

  const buyerAccount = getAccount(buyer);
  if (!buyerAccount || !isAuthenticated(buyer)) {
    return;
  }

  const vehicle = await findOwnedPlayerVehicle(offer.sellerUserId);
  if (!vehicle || vehicle.id !== offer.vehicleId) {
    buyer.sendClientMessage(Color.error, "Транспорт уже продан или недоступен.");
    return;
  }

  const licenseErr = await buyerCanPurchaseVehicle(buyer, vehicle.modelId);
  if (licenseErr) {
    buyer.sendClientMessage(Color.error, licenseErr);
    const sellerEarly = omp.players.at(offer.sellerSlot);
    if (sellerEarly && isPlayerActive(sellerEarly)) {
      sellerEarly.sendClientMessage(
        Color.error,
        `${playerName(buyer)} не может купить транспорт: ${licenseErr}`
      );
    }
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

  if (
    !isPlayerNearPersonalVehicle(seller, offer.runtimeId) ||
    !isPlayerNearPersonalVehicle(buyer, offer.runtimeId)
  ) {
    buyer.sendClientMessage(
      Color.error,
      "Оба должны быть в машине или рядом с ней. Сделка отменена."
    );
    seller.sendClientMessage(
      Color.error,
      "Оба должны быть в машине или рядом с ней. Сделка отменена."
    );
    return;
  }

  const personal = getPersonalRuntime(offer.runtimeId);
  if (
    !personal ||
    personal.dbId !== offer.vehicleId ||
    personal.ownerId !== offer.sellerUserId
  ) {
    buyer.sendClientMessage(Color.error, "Транспорт недоступен. Сделка отменена.");
    return;
  }

  if (buyerAccount.money < offer.price) {
    buyer.sendClientMessage(
      Color.error,
      `Недостаточно наличных (${formatMoney(offer.price)}).`
    );
    seller.sendClientMessage(
      Color.error,
      `${playerName(buyer)} не смог оплатить транспорт (${formatMoney(offer.price)}).`
    );
    return;
  }

  if (transferring.has(offer.vehicleId)) {
    buyer.sendClientMessage(Color.error, "Сделка уже обрабатывается.");
    return;
  }

  transferring.add(offer.vehicleId);
  let result;
  try {
    result = await transferPlayerVehicleSale({
      vehicleId: offer.vehicleId,
      sellerId: offer.sellerUserId,
      buyerId: buyerAccount.id,
      price: offer.price,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] передача ТС ${offer.vehicleId}: ${message}`);
    buyer.sendClientMessage(Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  } finally {
    transferring.delete(offer.vehicleId);
  }

  if (!result.ok) {
    if (result.reason === "owned") {
      buyer.sendClientMessage(Color.error, "У вас уже есть личный транспорт.");
      return;
    }
    if (result.reason === "funds") {
      buyer.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }
    if (result.reason === "vehicle") {
      buyer.sendClientMessage(Color.error, "Транспорт уже продан или недоступен.");
      return;
    }
    buyer.sendClientMessage(Color.error, "Сделка не прошла. Попробуйте ещё раз.");
    return;
  }

  setPersonalOwner(offer.runtimeId, buyerAccount.id);

  const liveRuntime = findRuntimeIdByDbId(offer.vehicleId);
  if (liveRuntime !== undefined && liveRuntime !== offer.runtimeId) {
    setPersonalOwner(liveRuntime, buyerAccount.id);
  }

  patchAccount(buyer, { money: result.buyerCash });
  const liveBuyer = getAccount(buyer);
  if (liveBuyer) {
    applyWallet(buyer, liveBuyer);
  }

  if (isPlayerActive(seller) && getAccount(seller)?.id === offer.sellerUserId) {
    patchAccount(seller, { money: result.sellerCash });
    const liveSeller = getAccount(seller);
    if (liveSeller) {
      applyWallet(seller, liveSeller);
    }
    seller.sendClientMessage(
      Color.info,
      `Игрок ${playerName(buyer)} купил ваш транспорт #${offer.vehicleId} за ${formatMoney(offer.price)}.`
    );
  }

  buyer.sendClientMessage(
    Color.info,
    `Вы купили транспорт #${offer.vehicleId} за ${formatMoney(offer.price)}.`
  );
}

function refuseCarOffer(buyer: Player, buyerSlot: number, offer: CarOffer): void {
  pendingOffers.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "car");
  buyer.sendClientMessage(Color.info, "Вы отказались от покупки транспорта.");

  const seller = omp.players.at(offer.sellerSlot);
  if (seller && isPlayerActive(seller)) {
    seller.sendClientMessage(
      Color.error,
      `${playerName(buyer)} отказался от покупки транспорта.`
    );
  }
}

/** null — можно купить; иначе текст ошибки для продавца/покупателя. */
async function buyerCanPurchaseVehicle(
  buyer: Player,
  modelId: number
): Promise<string | null> {
  const account = getAccount(buyer);
  if (!account) {
    return "Игрок не в игре.";
  }

  if (await findOwnedPlayerVehicle(account.id)) {
    return "У игрока уже есть личный транспорт.";
  }

  if (!findOwnedHouse(account.id)) {
    return "У покупателя нет дома.";
  }

  const need = requiredDriveLicense(modelId);
  if (need === "moto" && !account.licenses.moto) {
    return "У покупателя нет лицензии на мотоциклы.";
  }
  if (need === "car" && !account.licenses.car) {
    return "У покупателя нет лицензии на автомобили.";
  }
  if (need === "fly" && !account.licenses.fly) {
    return "У покупателя нет лицензии на полёты.";
  }

  return null;
}

function parseSellPlayerInput(raw: string): { slot: number; price: number } | null {
  const match = raw.trim().match(/^(\d+)\s*[,;]\s*(\d+)$/);
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
