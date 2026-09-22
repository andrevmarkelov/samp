import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { placeAt, type SpawnPoint } from "../spawn/point";
import { isNearHouseEntrance } from "./access";
import type { HouseRecord } from "./repository";
import { getHouse } from "./repository";
import { setInsideHouse } from "./session";
import { houseVirtualWorld } from "./world";

export function houseLockStatusLabel(isLocked: boolean): string {
  return isLocked ? "Закрыт" : "Открыт";
}

export function isHouseOwner(userId: number, house: HouseRecord): boolean {
  return house.ownerId === userId;
}

export function canEnterHouse(userId: number, house: HouseRecord): boolean {
  if (house.ownerId === null) {
    return false;
  }

  if (isHouseOwner(userId, house)) {
    return true;
  }

  return !house.isLocked;
}

export function houseInteriorSpawn(house: HouseRecord): SpawnPoint {
  return {
    x: house.interiorX,
    y: house.interiorY,
    z: house.interiorZ,
    angle: 0,
    interior: house.interiorId,
    world: houseVirtualWorld(house.id),
  };
}

export function teleportToHouseInterior(player: Player, house: HouseRecord): boolean {
  const slotId = playerId(player);
  if (slotId === null) {
    return false;
  }

  try {
    placeAt(player, houseInteriorSpawn(house));
    refreshStreamForPlayer(player);
    setInsideHouse(slotId, house.id);
    return true;
  } catch {
    return false;
  }
}

export function tryEnterHouse(player: Player, houseId: number): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const house = getHouse(houseId);
  if (!house || house.ownerId === null) {
    player.sendClientMessage(Color.error, "Этот дом свободен.");
    return;
  }

  if (!isNearHouseEntrance(player, houseId)) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу дома.");
    return;
  }

  if (!canEnterHouse(account.id, house)) {
    player.sendClientMessage(Color.error, "Дом закрыт.");
    return;
  }

  if (!teleportToHouseInterior(player, house)) {
    player.sendClientMessage(Color.error, "Не удалось войти в дом.");
  }
}
