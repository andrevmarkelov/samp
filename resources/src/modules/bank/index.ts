import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { assignStreamWorld, refreshStreamForPlayer } from "../mapping/stream";
import type { GameModule } from "../types";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { startTellers, tickTellers } from "./tellers";

export const BANK_WORLD = 2;

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const MAP_ICON_SLOT = 5;
const MAP_ICON_TYPE = 52;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

const STREET_PICKUP = {
  x: 1459.349,
  y: -1010.3751,
  z: 26.8438,
} as const;

const STREET_ICON = {
  x: 1461.4974,
  y: -1011.6652,
  z: 26.8438,
} as const;

const INTERIOR_PICKUP = {
  x: 1470.9153,
  y: -1014.1664,
  z: 38.1769,
} as const;

const FROM_STREET = {
  x: 1468.8136,
  y: -1013.938,
  z: 38.1769,
  angle: 88.5291,
  interior: 0,
} as const;

const FROM_INTERIOR: SpawnPoint = {
  x: 1459.2559,
  y: -1013.1017,
  z: 26.8438,
  angle: 178.1929,
  interior: 0,
  world: STREET_WORLD,
};

const INTERIOR_MAP = {
  minX: 1445,
  maxX: 1480,
  minY: -1025,
  maxY: -975,
  minZ: 32,
  maxZ: 50,
} as const;

const lastTeleportAt = new Map<number, number>();
const iconShown = new Set<number>();

export const bankModule: GameModule = {
  name: "bank",
  start() {
    assignStreamWorld(BANK_WORLD, isBankInteriorObject);

    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z,
      STREET_WORLD
    );

    new TextLabel(
      "Bank\nVkhod",
      Color.info,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z,
      BANK_WORLD
    );
    new TextLabel(
      "Vykhod na ulicu",
      Color.info,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      BANK_WORLD,
      false
    );
    startTellers(BANK_WORLD);

    setInterval(tickBank, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        lastTeleportAt.delete(id);
        iconShown.delete(id);
      }
    });
  },
};

function tickBank(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      const state = player.getState();
      updateIcon(player, pos.x, pos.y, world, interior);

      if (state !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (
        world === STREET_WORLD &&
        interior === 0 &&
        distance3d(pos.x, pos.y, pos.z, STREET_PICKUP.x, STREET_PICKUP.y, STREET_PICKUP.z) <=
          PICKUP_RADIUS
      ) {
        const inside = enterBank();
        teleport(player, inside);
        return;
      }

      if (
        world === BANK_WORLD &&
        interior === 0 &&
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
        return;
      }

      tickTellers(player, world, interior);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function enterBank(): SpawnPoint {
  return {
    ...FROM_STREET,
    world: BANK_WORLD,
  };
}

function isBankInteriorObject(object: { x: number; y: number; z: number }): boolean {
  return (
    object.x >= INTERIOR_MAP.minX &&
    object.x <= INTERIOR_MAP.maxX &&
    object.y >= INTERIOR_MAP.minY &&
    object.y <= INTERIOR_MAP.maxY &&
    object.z >= INTERIOR_MAP.minZ &&
    object.z <= INTERIOR_MAP.maxZ
  );
}

function updateIcon(
  player: Player,
  x: number,
  y: number,
  world: number,
  interior: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const near =
    world === STREET_WORLD &&
    interior === 0 &&
    distance2d(x, y, STREET_ICON.x, STREET_ICON.y) <= ICON_RADIUS;

  if (near) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        STREET_ICON.x,
        STREET_ICON.y,
        STREET_ICON.z,
        MAP_ICON_TYPE,
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
    player.removeMapIcon(MAP_ICON_SLOT);
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
