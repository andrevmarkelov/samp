import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { isAuthenticated } from "../auth/session";
import { isPlayerActive, playerId } from "../../shared/player";
import { Color } from "../../shared/colors";
import type { GameModule } from "../types";
import { refreshStreamForPlayer } from "../mapping/stream";
import {
  HOSPITAL_WORLD,
  STREET_WORLD,
  placeAt,
  type SpawnPoint,
} from "../spawn/point";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const HOSPITAL_MAP_ICON_SLOT = 0;
const HOSPITAL_MAP_ICON_TYPE = 22;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

const STREET_PICKUP = {
  x: 1172.8518,
  y: -1323.344,
  z: 15.3998,
} as const;

const INTERIOR_PICKUP = {
  x: 1607.174,
  y: 1810.1447,
  z: -20.7665,
} as const;

const FROM_STREET: SpawnPoint = {
  x: 1607.1842,
  y: 1807.3461,
  z: -20.7645,
  angle: 179.9952,
  interior: 0,
  world: HOSPITAL_WORLD,
};

const FROM_INTERIOR: SpawnPoint = {
  x: 1177.4657,
  y: -1323.7079,
  z: 14.0721,
  angle: 270.3613,
  interior: 0,
  world: STREET_WORLD,
};

const lastTeleportAt = new Map<number, number>();
const iconShown = new Set<number>();

export const hospitalModule: GameModule = {
  name: "hospital",
  start() {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z,
      STREET_WORLD
    );
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z,
      HOSPITAL_WORLD
    );

    createPickupLabel(STREET_PICKUP, STREET_WORLD, "Gorodskaya bolnica\nVkhod");
    createPickupLabel(INTERIOR_PICKUP, HOSPITAL_WORLD, "Vykhod na ulicu");

    setInterval(tickHospital, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        lastTeleportAt.delete(id);
        iconShown.delete(id);
      }
    });
  },
};

function createPickupLabel(
  at: { x: number; y: number; z: number },
  world: number,
  text: string
): void {
  new TextLabel(
    text,
    Color.info,
    at.x,
    at.y,
    at.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );
}

function tickHospital(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const state = player.getState();
      updateHospitalIcon(player, pos.x, pos.y, world);

      if (state !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (
        world === STREET_WORLD &&
        distance3d(pos.x, pos.y, pos.z, STREET_PICKUP.x, STREET_PICKUP.y, STREET_PICKUP.z) <=
          PICKUP_RADIUS
      ) {
        teleport(player, FROM_STREET);
        return;
      }

      if (
        world === HOSPITAL_WORLD &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          INTERIOR_PICKUP.x,
          INTERIOR_PICKUP.y,
          INTERIOR_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        teleport(player, FROM_INTERIOR);
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function updateHospitalIcon(
  player: Player,
  x: number,
  y: number,
  world: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const nearStreet =
    world === STREET_WORLD &&
    distance2d(x, y, STREET_PICKUP.x, STREET_PICKUP.y) <= ICON_RADIUS;

  if (nearStreet) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        HOSPITAL_MAP_ICON_SLOT,
        STREET_PICKUP.x,
        STREET_PICKUP.y,
        STREET_PICKUP.z,
        HOSPITAL_MAP_ICON_TYPE,
        0,
        MAPICON_LOCAL
      );
      iconShown.add(id);
    } catch {
      // Игрок уже вышел.
    }
    return;
  }

  if (!iconShown.has(id)) {
    return;
  }

  try {
    player.removeMapIcon(HOSPITAL_MAP_ICON_SLOT);
  } catch {
    // Игрок уже вышел.
  }
  iconShown.delete(id);
}

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
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

function teleport(player: Player, point: SpawnPoint): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const last = lastTeleportAt.get(id) ?? 0;
  if (now - last < TELEPORT_COOLDOWN_MS) {
    return;
  }

  lastTeleportAt.set(id, now);

  try {
    placeAt(player, point);
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}
