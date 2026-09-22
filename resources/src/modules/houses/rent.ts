import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt } from "../spawn/point";
import { updateEntrancePickup } from "./entrances";
import { refreshAllHouseMapIcons } from "./map-icons";
import { currentDateLocal, rentDaysLeftLabel, rentDaysRemaining } from "./rent-math";
import {
  clearHouseForSale,
  findOwnedHouse,
  forfeitExpiredHouses,
  getHouse,
  type HouseRecord,
} from "./repository";
import { clearInsideHouse, getInsideHouse } from "./session";
import { houseVirtualWorld } from "./world";

const RENT_CHECK_MS = 60_000;
const RENT_REMINDER_DAYS = 5;

let lastRentDate = currentDateLocal();

export function notifyHouseRentReminder(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    return;
  }

  const daysLeft = rentDaysRemaining(house.rentPaidUntil);
  if (daysLeft === null || daysLeft > RENT_REMINDER_DAYS) {
    return;
  }

  try {
    if (daysLeft === 0) {
      player.sendClientMessage(
        Color.error,
        "Сегодня последний день оплаты дома. Иначе государство заберёт его завтра."
      );
      player.sendClientMessage(Color.gray, "Оплатите жильё в банке.");
      return;
    }

    player.sendClientMessage(
      Color.tryOk,
      `До оплаты дома №${house.id} осталось ${daysLeft} ${rentDaysLeftLabel(daysLeft)}.`
    );
    player.sendClientMessage(Color.gray, "Оплатите жильё в банке.");
  } catch {
    // Игрок уже вышел.
  }
}

export function isRentCurrent(house: HouseRecord): boolean {
  if (house.ownerId === null || house.rentPaidUntil === null) {
    return false;
  }

  return house.rentPaidUntil >= currentDateLocal();
}

export function isRentLastDay(house: HouseRecord): boolean {
  return house.rentPaidUntil !== null && house.rentPaidUntil === currentDateLocal();
}

export function startHouseRentScheduler(): void {
  lastRentDate = currentDateLocal();
  void runRentForfeiture("startup");

  setInterval(() => {
    const today = currentDateLocal();
    if (today === lastRentDate) {
      return;
    }

    lastRentDate = today;
    void runRentForfeiture("midnight");
  }, RENT_CHECK_MS);
}

async function runRentForfeiture(source: "startup" | "midnight"): Promise<void> {
  let houseIds: number[];
  try {
    houseIds = await forfeitExpiredHouses();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] аренда домов (${source}): ${message}`);
    return;
  }

  if (houseIds.length === 0) {
    return;
  }

  omp.log(`[${SERVER_TAG}] аренда домов (${source}): изъято ${houseIds.length}`);

  for (const houseId of houseIds) {
    applyForfeitedHouse(houseId);
  }
}

type VacateHouseMessages = {
  insideMessage: string;
  ownerMessage: string;
};

export function applyForfeitedHouse(houseId: number): void {
  applyHouseVacated(houseId, {
    insideMessage: `Дом №${houseId} изъят государством за неуплату.`,
    ownerMessage: `Дом №${houseId} изъят государством за неуплату. Компенсация не выплачивается.`,
  });
}

export function applyAdminVacatedHouse(houseId: number): void {
  applyHouseVacated(houseId, {
    insideMessage: `Дом №${houseId} освобождён администрацией.`,
    ownerMessage: `Ваш дом №${houseId} продан государству администратором.`,
  });
}

function applyHouseVacated(houseId: number, messages: VacateHouseMessages): void {
  const house = getHouse(houseId);
  if (!house) {
    return;
  }

  const ownerId = house.ownerId;
  clearHouseForSale(houseId);
  updateEntrancePickup(houseId);

  if (ownerId !== null) {
    evictPlayersFromHouse(houseId, house, messages.insideMessage);
    notifyHouseOwner(ownerId, houseId, messages.ownerMessage);
  }

  refreshAllHouseMapIcons();
}

function evictPlayersFromHouse(
  houseId: number,
  house: HouseRecord,
  message: string
): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    let inside = getInsideHouse(slotId) === houseId;
    try {
      inside = inside || player.getVirtualWorld() === houseVirtualWorld(houseId);
    } catch {
      if (!inside) {
        return;
      }
    }

    if (!inside) {
      return;
    }

    clearInsideHouse(slotId);

    try {
      placeAt(player, {
        x: house.entranceX,
        y: house.entranceY,
        z: house.entranceZ,
        angle: 0,
        interior: 0,
        world: STREET_WORLD,
      });
      refreshStreamForPlayer(player);
      player.sendClientMessage(Color.error, message);
    } catch {
      // Игрок уже вышел.
    }
  });
}

function notifyHouseOwner(ownerId: number, houseId: number, message: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.id !== ownerId) {
      return;
    }

    const slotId = playerId(player);
    if (slotId !== null && getInsideHouse(slotId) === houseId) {
      return;
    }

    try {
      player.sendClientMessage(Color.error, message);
    } catch {
      // Игрок уже вышел.
    }
  });
}
