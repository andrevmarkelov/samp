import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { SERVER_TAG } from "../../shared/brand";
import { updateEntrancePickup } from "./entrances";
import { teleportToHouseInterior } from "./enter";
import { refreshAllHouseMapIcons } from "./map-icons";
import { currentDateLocal } from "./rent-math";
import {
  findOwnedHouse,
  getHouse,
  purchaseHouse,
  setHouseOwner,
  setHouseRentPaidUntil,
} from "./repository";

import { isNearHouseEntrance } from "./access";

const MIN_BUY_LEVEL = 3;

const buying = new Set<number>();

export async function tryPurchaseHouse(player: Player, houseId: number): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const house = getHouse(houseId);
  if (!house || house.ownerId !== null) {
    player.sendClientMessage(Color.error, "Этот дом уже куплен.");
    return;
  }

  if (account.level < MIN_BUY_LEVEL) {
    player.sendClientMessage(Color.error, "Купить дом можно с 3 уровня.");
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  if (findOwnedHouse(account.id)) {
    player.sendClientMessage(Color.error, "У вас уже есть дом.");
    return;
  }

  const cash = Math.max(0, Math.floor(account.money));
  if (cash < house.price) {
    player.sendClientMessage(Color.error, "Недостаточно наличных.");
    return;
  }

  if (!isNearHouseEntrance(player, houseId)) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу дома.");
    return;
  }

  if (buying.has(account.id)) {
    return;
  }

  buying.add(account.id);
  let result;
  try {
    result = await purchaseHouse(houseId, account.id);
  } catch (error: unknown) {
    buying.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] покупка дома ${houseId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }
  buying.delete(account.id);

  if (!result.ok) {
    if (result.reason === "owned") {
      player.sendClientMessage(Color.error, "У вас уже есть дом.");
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }
    if (result.reason === "sold") {
      player.sendClientMessage(Color.error, "Этот дом уже куплен.");
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  if (
    !isPlayerActive(player) ||
    getAccount(player)?.id !== account.id ||
    !isNearHouseEntrance(player, houseId)
  ) {
    return;
  }

  const owned = setHouseOwner(houseId, account.id, account.name);
  if (!owned) {
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  setHouseRentPaidUntil(houseId, currentDateLocal());

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  void saveUserMoney(account.id, result.cashLeft, account.bank).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить деньги ${account.name}: ${message}`);
  });

  updateEntrancePickup(houseId);
  refreshAllHouseMapIcons();

  if (!teleportToHouseInterior(player, owned)) {
    player.sendClientMessage(Color.error, "Дом куплен, но телепорт не удался.");
    return;
  }

  player.sendClientMessage(
    Color.info,
    `Поздравляем с покупкой дома №${owned.id} за $${owned.price}!`
  );
  player.sendClientMessage(
    Color.info,
    "Дом оплачен на сегодня. Для продления обратитесь в банк и оплатите жильё."
  );
  player.sendClientMessage(
    Color.info,
    "Для управления домом используйте /hmenu внутри интерьера."
  );
}
