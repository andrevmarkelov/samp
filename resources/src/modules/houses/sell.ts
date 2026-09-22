import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { isNearOwnHouse } from "./access";
import { updateEntrancePickup } from "./entrances";
import { refreshAllHouseMapIcons } from "./map-icons";
import {
  clearHouseForSale,
  findOwnedHouse,
  getHouse,
  sellHouseToState,
} from "./repository";
import { clearInsideHouse } from "./session";

export const HOUSE_SELL_DIALOG_ID = 46;

const DIALOG_STYLE_MSGBOX = 0;

const selling = new Set<number>();

export function bindHouseSellDialog(): void {
  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== HOUSE_SELL_DIALOG_ID) {
      return;
    }

    if (Number(response) === 0) {
      return;
    }

    void confirmSellHouse(player);
  });
}

export function showSellHouseDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    player.sendClientMessage(Color.error, "У вас нет дома.");
    return;
  }

  if (!isNearOwnHouse(player, house.id)) {
    player.sendClientMessage(Color.error, "Подойдите к своему дому.");
    return;
  }

  try {
    Dialog.show(
      player,
      HOUSE_SELL_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Продажа дома",
      `Вы хотите продать дом (№${house.id}) государству за: $${house.price}?`,
      "Продать",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть окно продажи.");
  }
}

async function confirmSellHouse(player: Player): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    player.sendClientMessage(Color.error, "У вас нет дома.");
    return;
  }

  if (!isNearOwnHouse(player, house.id)) {
    player.sendClientMessage(Color.error, "Подойдите к своему дому.");
    return;
  }

  if (selling.has(account.id)) {
    return;
  }

  selling.add(account.id);
  let result;
  try {
    result = await sellHouseToState(house.id, account.id);
  } catch (error: unknown) {
    selling.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] продажа дома ${house.id} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }
  selling.delete(account.id);

  if (!result.ok) {
    if (result.reason === "owner") {
      player.sendClientMessage(Color.error, "У вас нет дома.");
      return;
    }
    player.sendClientMessage(Color.error, "Продажа не прошла. Попробуйте ещё раз.");
    return;
  }

  if (
    !isPlayerActive(player) ||
    getAccount(player)?.id !== account.id ||
    !isNearOwnHouse(player, house.id)
  ) {
    return;
  }

  const cleared = clearHouseForSale(house.id);
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

  updateEntrancePickup(house.id);
  refreshAllHouseMapIcons();
  clearInsideHouse(slotId);

  const sold = getHouse(house.id);
  player.sendClientMessage(
    Color.info,
    `Вы продали дом №${house.id} государству за $${sold?.price ?? result.price}.`
  );
}
