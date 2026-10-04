import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import type { BusinessRecord } from "./repository";
import { businessHasInterior, getBusiness, listBusinesses } from "./repository";
import { clearInsideBusiness, getInsideBusiness, setInsideBusiness } from "./session";
import { isClothesType } from "./types";
import { businessIdFromVirtualWorld, businessVirtualWorld } from "./world";

const EXIT_PICKUP_MODEL = 19132;
const BUY_PICKUP_MODEL = 1274;
const CLOTHES_BUY_PICKUP_MODEL = 1275;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const TELEPORT_COOLDOWN_MS = 1500;
const TICK_MS = 200;
/** Левый ALT — медленная ходьба (KEY_WALK). */
const KEY_WALK = 1024;

const nearExit = new Map<number, number>();
const lastTeleportAt = new Map<number, number>();

export function startBusinessExits(): void {
  for (const business of listBusinesses()) {
    if (!businessHasInterior(business)) {
      continue;
    }

    const world = businessVirtualWorld(business.id);
    const x = business.interiorX as number;
    const y = business.interiorY as number;
    const z = business.interiorZ as number;

    new Pickup(EXIT_PICKUP_MODEL, PICKUP_TYPE, x, y, z, world);
    new TextLabel("Выход", Color.info, x, y, z + LABEL_HEIGHT, LABEL_DRAW_DISTANCE, world, false);

    if (
      business.buyPickupX !== null &&
      business.buyPickupY !== null &&
      business.buyPickupZ !== null
    ) {
      new Pickup(
        isClothesType(business.typeId) ? CLOTHES_BUY_PICKUP_MODEL : BUY_PICKUP_MODEL,
        PICKUP_TYPE,
        business.buyPickupX,
        business.buyPickupY,
        business.buyPickupZ,
        world
      );
    }
  }

  setInterval(tickBusinessExits, TICK_MS);

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_WALK) === 0) {
      return;
    }

    tryExitBusiness(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      nearExit.delete(id);
      lastTeleportAt.delete(id);
      clearInsideBusiness(id);
    }
  });
}

function tickBusinessExits(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        nearExit.delete(id);
        return;
      }

      const pos = player.getPos();
      const interior = player.getInterior();
      const world = player.getVirtualWorld();
      const business = findInteriorExitBusiness(pos.x, pos.y, pos.z, interior, world, id);

      if (!business) {
        nearExit.delete(id);
        return;
      }

      nearExit.set(id, business.id);
    } catch {
      nearExit.delete(id);
    }
  });
}

function tryExitBusiness(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const businessId = nearExit.get(id);
  if (businessId === undefined) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !businessHasInterior(business)) {
    nearExit.delete(id);
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }

    const pos = player.getPos();
    const interior = player.getInterior();
    const world = player.getVirtualWorld();
    if (!isNearInteriorExit(pos.x, pos.y, pos.z, interior, world, business)) {
      nearExit.delete(id);
      return;
    }
  } catch {
    return;
  }

  const now = Date.now();
  const last = lastTeleportAt.get(id) ?? 0;
  if (now - last < TELEPORT_COOLDOWN_MS) {
    return;
  }

  lastTeleportAt.set(id, now);
  clearInsideBusiness(id);
  nearExit.delete(id);

  const exit: SpawnPoint = {
    x: business.entranceX,
    y: business.entranceY,
    z: business.entranceZ,
    angle: 0,
    interior: 0,
    world: STREET_WORLD,
  };

  try {
    placeAt(player, exit);
    refreshStreamForPlayer(player);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось выйти из бизнеса.");
  }
}

function findInteriorExitBusiness(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  slotId: number
): BusinessRecord | null {
  const businessId = businessIdFromVirtualWorld(world);
  if (businessId === null) {
    return null;
  }

  const sessionId = getInsideBusiness(slotId);
  if (sessionId !== null && sessionId !== businessId) {
    return null;
  }

  const business = getBusiness(businessId);
  if (!business || !isNearInteriorExit(x, y, z, interior, world, business)) {
    return null;
  }

  setInsideBusiness(slotId, businessId);
  return business;
}

function isNearInteriorExit(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  business: BusinessRecord
): boolean {
  if (
    !businessHasInterior(business) ||
    interior !== business.interiorId ||
    world !== businessVirtualWorld(business.id) ||
    business.interiorX === null ||
    business.interiorY === null ||
    business.interiorZ === null
  ) {
    return false;
  }

  return (
    distance3d(x, y, z, business.interiorX, business.interiorY, business.interiorZ) <=
    PICKUP_RADIUS
  );
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
