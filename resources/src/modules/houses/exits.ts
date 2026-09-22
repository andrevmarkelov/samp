import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import type { HouseRecord } from "./repository";
import { getHouse, listHouses } from "./repository";
import { clearInsideHouse, getInsideHouse, setInsideHouse } from "./session";
import { houseIdFromVirtualWorld, houseVirtualWorld } from "./world";

const EXIT_PICKUP_MODEL = 19132;
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

export function startHouseExits(): void {
  for (const house of listHouses()) {
    const world = houseVirtualWorld(house.id);
    new Pickup(
      EXIT_PICKUP_MODEL,
      PICKUP_TYPE,
      house.interiorX,
      house.interiorY,
      house.interiorZ,
      world
    );
    new TextLabel(
      "Выход",
      Color.info,
      house.interiorX,
      house.interiorY,
      house.interiorZ + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      world,
      false
    );
  }

  setInterval(tickHouseExits, TICK_MS);

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_WALK) === 0) {
      return;
    }

    tryExitHouse(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      nearExit.delete(id);
      lastTeleportAt.delete(id);
      clearInsideHouse(id);
    }
  });
}

function tickHouseExits(): void {
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
      const house = findInteriorExitHouse(pos.x, pos.y, pos.z, interior, world, id);

      if (!house) {
        nearExit.delete(id);
        return;
      }

      nearExit.set(id, house.id);
    } catch {
      nearExit.delete(id);
    }
  });
}

function tryExitHouse(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const houseId = nearExit.get(id);
  if (houseId === undefined) {
    return;
  }

  const house = getHouse(houseId);
  if (!house) {
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
    if (!isNearInteriorExit(pos.x, pos.y, pos.z, interior, world, house)) {
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
  clearInsideHouse(id);
  nearExit.delete(id);

  const exit: SpawnPoint = {
    x: house.entranceX,
    y: house.entranceY,
    z: house.entranceZ,
    angle: 0,
    interior: 0,
    world: STREET_WORLD,
  };

  try {
    placeAt(player, exit);
    refreshStreamForPlayer(player);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось выйти из дома.");
  }
}

function findInteriorExitHouse(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  slotId: number
): HouseRecord | null {
  const houseId = houseIdFromVirtualWorld(world);
  if (houseId === null) {
    return null;
  }

  const sessionHouseId = getInsideHouse(slotId);
  if (sessionHouseId !== null && sessionHouseId !== houseId) {
    return null;
  }

  const house = getHouse(houseId);
  if (!house || !isNearInteriorExit(x, y, z, interior, world, house)) {
    return null;
  }

  setInsideHouse(slotId, houseId);
  return house;
}

function isNearInteriorExit(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  house: HouseRecord
): boolean {
  if (interior !== house.interiorId || world !== houseVirtualWorld(house.id)) {
    return false;
  }

  return (
    distance3d(x, y, z, house.interiorX, house.interiorY, house.interiorZ) <=
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
