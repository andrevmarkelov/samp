import type { Player } from "@omp-node/core";
import { STREET_WORLD } from "../spawn/point";
import { getHouse } from "./repository";

export const PICKUP_RADIUS = 1.5;
export const HOUSE_NEAR_RADIUS = 4;

const PLAYER_STATE_ONFOOT = 1;

export function isNearHouseEntrance(
  player: Player,
  houseId: number,
  radius = PICKUP_RADIUS
): boolean {
  const house = getHouse(houseId);
  if (!house) {
    return false;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }

    const pos = player.getPos();
    return (
      distance3d(
        pos.x,
        pos.y,
        pos.z,
        house.entranceX,
        house.entranceY,
        house.entranceZ
      ) <= radius
    );
  } catch {
    return false;
  }
}

export function isNearOwnHouse(player: Player, houseId: number): boolean {
  if (!isNearHouseEntrance(player, houseId, HOUSE_NEAR_RADIUS)) {
    return false;
  }

  try {
    return player.getVirtualWorld() === STREET_WORLD && player.getInterior() === 0;
  } catch {
    return false;
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
