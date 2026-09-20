import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import {
  LCN_WORLD,
  MAFIA_INTERIOR,
  RUSSIAN_MAFIA_WORLD,
  YAKUZA_WORLD,
} from "./mafias";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

const INTERIOR_ENTER: SpawnPoint = {
  x: 1299.0159,
  y: -793.9708,
  z: 1084.0078,
  angle: 359.6397,
  interior: MAFIA_INTERIOR,
  world: STREET_WORLD,
};

const INTERIOR_EXIT_PICKUP = {
  x: 1298.8882,
  y: -796.6086,
  z: 1084.0078,
};

type MafiaDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
};

function hqDoors(
  enterLabel: string,
  world: number,
  streetPickup: { x: number; y: number; z: number },
  streetExit: SpawnPoint
): MafiaDoor[] {
  return [
    {
      pickup: {
        x: streetPickup.x,
        y: streetPickup.y,
        z: streetPickup.z,
        interior: 0,
        world: STREET_WORLD,
      },
      dest: { ...INTERIOR_ENTER, world },
      label: enterLabel,
    },
    {
      pickup: {
        x: INTERIOR_EXIT_PICKUP.x,
        y: INTERIOR_EXIT_PICKUP.y,
        z: INTERIOR_EXIT_PICKUP.z,
        interior: MAFIA_INTERIOR,
        world,
      },
      dest: streetExit,
      label: "Vykhod na ulicu",
    },
  ];
}

const DOORS: readonly MafiaDoor[] = [
  ...hqDoors("LCN\nVkhod", LCN_WORLD, { x: 1122.7086, y: -2036.9874, z: 69.8942 }, {
    x: 1125.1136,
    y: -2036.9993,
    z: 69.8822,
    angle: 270.7142,
    interior: 0,
    world: STREET_WORLD,
  }),
  ...hqDoors("Yakuza\nVkhod", YAKUZA_WORLD, { x: 678.3608, y: -1281.7167, z: 13.6332 }, {
    x: 675.7552,
    y: -1281.6864,
    z: 13.6332,
    angle: 91.1727,
    interior: 0,
    world: STREET_WORLD,
  }),
  ...hqDoors(
    "Russkaya mafiya\nVkhod",
    RUSSIAN_MAFIA_WORLD,
    { x: 952.5553, y: -909.2405, z: 45.7656 },
    {
      x: 952.6013,
      y: -912.1279,
      z: 45.7656,
      angle: 181.7035,
      interior: 0,
      world: STREET_WORLD,
    }
  ),
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindMafiaDoors(): void {
  for (const door of DOORS) {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z,
      door.pickup.world
    );
    new TextLabel(
      door.label,
      Color.info,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      door.pickup.world,
      false
    );
  }

  setInterval(tickMafiaDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickMafiaDoors(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        return;
      }

      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      const pos = player.getPos();
      for (const door of DOORS) {
        if (world !== door.pickup.world || interior !== door.pickup.interior) {
          continue;
        }

        if (near(pos, door.pickup)) {
          tryUse(player, door);
          return;
        }
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryUse(player: Player, door: MafiaDoor): void {
  const account = getAccount(player);
  if (account?.hospitalized) {
    deny(player, "Vam nuzhno lechenie. Zanimite koyku: /hospital.");
    return;
  }

  teleport(player, door.dest);
}

function deny(player: Player, message: string): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const last = lastDenyAt.get(id) ?? 0;
  if (now - last < DENY_COOLDOWN_MS) {
    return;
  }

  lastDenyAt.set(id, now);
  try {
    player.sendClientMessage(Color.error, message);
  } catch {
    // Игрок уже вышел.
  }
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

function near(
  pos: { x: number; y: number; z: number },
  point: { x: number; y: number; z: number }
): boolean {
  return distance3d(pos.x, pos.y, pos.z, point.x, point.y, point.z) <= PICKUP_RADIUS;
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

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
  }
}
