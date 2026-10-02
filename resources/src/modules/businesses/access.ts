import type { Player } from "@omp-node/core";
import { STREET_WORLD } from "../spawn/point";
import { getBusiness, listBusinesses, type BusinessRecord } from "./repository";

export const BUSINESS_BUY_RADIUS = 2;

const PLAYER_STATE_ONFOOT = 1;

export function isNearBusinessEntrance(
  player: Player,
  businessId: number,
  radius = BUSINESS_BUY_RADIUS
): boolean {
  const business = getBusiness(businessId);
  if (!business) {
    return false;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }

    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return (
      distance3d(
        pos.x,
        pos.y,
        pos.z,
        business.entranceX,
        business.entranceY,
        business.entranceZ
      ) <= radius
    );
  } catch {
    return false;
  }
}

export function findNearbyForSaleBusiness(player: Player): BusinessRecord | null {
  return findNearbyBusiness(player, (business) => business.ownerId === null);
}

export function findNearbyOwnedBusiness(
  player: Player,
  ownerId: number
): BusinessRecord | null {
  return findNearbyBusiness(player, (business) => business.ownerId === ownerId);
}

function findNearbyBusiness(
  player: Player,
  predicate: (business: BusinessRecord) => boolean
): BusinessRecord | null {
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return null;
    }

    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return null;
    }

    const pos = player.getPos();
    let best: BusinessRecord | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const business of listBusinesses()) {
      if (!predicate(business)) {
        continue;
      }

      const distance = distance3d(
        pos.x,
        pos.y,
        pos.z,
        business.entranceX,
        business.entranceY,
        business.entranceZ
      );
      if (distance > BUSINESS_BUY_RADIUS || distance >= bestDistance) {
        continue;
      }

      best = business;
      bestDistance = distance;
    }

    return best;
  } catch {
    return null;
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
