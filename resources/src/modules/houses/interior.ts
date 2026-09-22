import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import type { HouseRecord } from "./repository";
import { getHouse } from "./repository";
import { getInsideHouse } from "./session";
import { houseIdFromVirtualWorld, houseVirtualWorld } from "./world";

export const HOUSE_INTERIOR_RADIUS = 20;

export function isInsideHouseInterior(player: Player, house: HouseRecord): boolean {
  try {
    const pos = player.getPos();
    return (
      player.getVirtualWorld() === houseVirtualWorld(house.id) &&
      player.getInterior() === house.interiorId &&
      distance3d(
        pos.x,
        pos.y,
        pos.z,
        house.interiorX,
        house.interiorY,
        house.interiorZ
      ) <= HOUSE_INTERIOR_RADIUS
    );
  } catch {
    return false;
  }
}

export function findHouseAtInterior(player: Player): HouseRecord | null {
  const slotId = playerId(player);
  if (slotId === null) {
    return null;
  }

  let houseId = getInsideHouse(slotId);
  if (houseId === null) {
    try {
      houseId = houseIdFromVirtualWorld(player.getVirtualWorld());
    } catch {
      return null;
    }
  }

  if (houseId === null) {
    return null;
  }

  const house = getHouse(houseId);
  if (!house || !isInsideHouseInterior(player, house)) {
    return null;
  }

  return house;
}

export function findOwnedHouseAtInterior(player: Player): HouseRecord | null {
  const account = getAccount(player);
  if (!account) {
    return null;
  }

  const house = findHouseAtInterior(player);
  if (!house || house.ownerId !== account.id) {
    return null;
  }

  return house;
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
