import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { AUTOSCHOOL_INTERIOR } from "./autoschool";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

type SchoolDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
};

const DOORS: readonly SchoolDoor[] = [
  {
    pickup: {
      x: 739.0363,
      y: -1418.4604,
      z: 13.5234,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: -2028.7318,
      y: -105.0821,
      z: 1035.1719,
      angle: 91.831,
      interior: AUTOSCHOOL_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Avtoshkola\nVkhod",
  },
  {
    pickup: {
      x: -2026.9169,
      y: -103.7116,
      z: 1035.1719,
      interior: AUTOSCHOOL_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 738.9961,
      y: -1415.0342,
      z: 13.5172,
      angle: 1.5583,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Vykhod na ulicu",
  },
  {
    pickup: {
      x: 739.0686,
      y: -1428.905,
      z: 13.8984,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: -2029.7469,
      y: -117.9779,
      z: 1035.1719,
      angle: 0.6735,
      interior: AUTOSCHOOL_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Avtoshkola\nParkovka",
  },
  {
    pickup: {
      x: -2029.702,
      y: -119.6243,
      z: 1035.1719,
      interior: AUTOSCHOOL_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 738.9785,
      y: -1431.2201,
      z: 13.5234,
      angle: 178.9066,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Parkovka",
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindAutoschoolDoors(): void {
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

  setInterval(tickSchoolDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickSchoolDoors(): void {
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

function tryUse(player: Player, door: SchoolDoor): void {
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
