import { Dialog, omp, Pickup, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import { houseClassLabel } from "./classes";
import { dailyHouseRent } from "./rent-math";
import { houseLockStatusLabel, tryEnterHouse } from "./enter";
import { tryPurchaseHouse } from "./purchase";
import type { HouseRecord } from "./repository";
import { getHouse, listHouses } from "./repository";

export const HOUSE_BUY_DIALOG_ID = 42;
export const HOUSE_ENTER_DIALOG_ID = 43;

const PICKUP_FOR_SALE = 1273;
const PICKUP_OCCUPIED = 19522;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const DIALOG_STYLE_MSGBOX = 0;
const FREE_TITLE = "{33FF33}";
const OCCUPIED_TITLE = "{FF9900}";
const LABEL = "{FFFFFF}";
const VALUE = "{FFFFFF}";
const OWNER_VALUE = "{33CCFF}";

const standingOn = new Map<number, number>();
const pendingBuyHouse = new Map<number, number>();
const pendingEnterHouse = new Map<number, number>();
const entrancePickups = new Map<number, Pickup>();

function entrancePickupModel(house: HouseRecord): number {
  return house.ownerId === null ? PICKUP_FOR_SALE : PICKUP_OCCUPIED;
}

function createEntrancePickup(house: HouseRecord): Pickup {
  return new Pickup(
    entrancePickupModel(house),
    PICKUP_TYPE,
    house.entranceX,
    house.entranceY,
    house.entranceZ,
    STREET_WORLD
  );
}

export function updateEntrancePickup(houseId: number): void {
  const house = getHouse(houseId);
  if (!house) {
    return;
  }

  const current = entrancePickups.get(houseId);
  if (current) {
    try {
      current.destroy();
    } catch {
      // Пикап уже уничтожен.
    }
  }

  entrancePickups.set(houseId, createEntrancePickup(house));
}

export function startHouseEntrances(): void {
  for (const house of listHouses()) {
    entrancePickups.set(house.id, createEntrancePickup(house));
  }

  setInterval(tickHouseEntrances, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response) => {
    const id = Number(dialogId);
    if (id !== HOUSE_BUY_DIALOG_ID && id !== HOUSE_ENTER_DIALOG_ID) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    if (id === HOUSE_BUY_DIALOG_ID && Number(response) !== 0) {
      const houseId = pendingBuyHouse.get(slotId);
      pendingBuyHouse.delete(slotId);
      pendingEnterHouse.delete(slotId);
      if (houseId !== undefined) {
        standingOn.delete(slotId);
        void tryPurchaseHouse(player, houseId);
      }
      return;
    }

    if (id === HOUSE_ENTER_DIALOG_ID && Number(response) !== 0) {
      const houseId = pendingEnterHouse.get(slotId);
      pendingBuyHouse.delete(slotId);
      pendingEnterHouse.delete(slotId);
      if (houseId !== undefined) {
        standingOn.delete(slotId);
        tryEnterHouse(player, houseId);
      }
      return;
    }

    pendingBuyHouse.delete(slotId);
    pendingEnterHouse.delete(slotId);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      standingOn.delete(id);
      pendingBuyHouse.delete(id);
      pendingEnterHouse.delete(id);
    }
  });
}

function tickHouseEntrances(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();

      if (world !== STREET_WORLD || interior !== 0 || player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(id);
        pendingBuyHouse.delete(id);
        pendingEnterHouse.delete(id);
        return;
      }

      const house = findHouseAt(pos.x, pos.y, pos.z);
      if (!house) {
        standingOn.delete(id);
        pendingBuyHouse.delete(id);
        pendingEnterHouse.delete(id);
        return;
      }

      if (standingOn.get(id) === house.id) {
        return;
      }

      standingOn.set(id, house.id);
      if (house.ownerId === null) {
        pendingBuyHouse.set(id, house.id);
        showFreeHouseDialog(player, house);
        return;
      }

      pendingBuyHouse.delete(id);
      pendingEnterHouse.set(id, house.id);
      showOccupiedHouseDialog(player, house);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function findHouseAt(x: number, y: number, z: number): HouseRecord | null {
  let best: HouseRecord | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const house of listHouses()) {
    const distance = distance3d(x, y, z, house.entranceX, house.entranceY, house.entranceZ);
    if (distance > PICKUP_RADIUS || distance >= bestDistance) {
      continue;
    }

    best = house;
    bestDistance = distance;
  }

  return best;
}

function showFreeHouseDialog(player: Player, house: HouseRecord): void {
  const body = [
    `${LABEL}Тип:\t\t\t${VALUE}${houseClassLabel(house.classId)}`,
    `${LABEL}Номер дома:\t\t${VALUE}${house.id}`,
    `${LABEL}Стоимость:\t\t${VALUE}${house.price}$`,
    `${LABEL}Аренда:\t\t${VALUE}$${dailyHouseRent(house.price)}/день`,
    "",
    `${LABEL}При покупке дом оплачен на сегодня.`,
    `${LABEL}Продление — в банке.`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      HOUSE_BUY_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${FREE_TITLE}Дом свободен`,
      body,
      "Купить",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть окно дома.");
  }
}

function showOccupiedHouseDialog(player: Player, house: HouseRecord): void {
  const owner = house.ownerName ?? "Неизвестно";
  const body = [
    `${LABEL}Владелец:\t\t${OWNER_VALUE}${owner}`,
    `${LABEL}Тип:\t\t\t${VALUE}${houseClassLabel(house.classId)}`,
    `${LABEL}Номер дома:\t\t${VALUE}${house.id}`,
    `${LABEL}Стоимость:\t\t${VALUE}${house.price}$`,
    `${LABEL}Статус:\t\t${VALUE}${houseLockStatusLabel(house.isLocked)}`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      HOUSE_ENTER_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${OCCUPIED_TITLE}Дом занят`,
      body,
      "Войти",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть окно дома.");
  }
}

function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}
