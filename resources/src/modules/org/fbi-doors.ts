import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { FBI_INTERIOR, ORG_FBI_ID } from "./fbi";
import { getMembership } from "./membership";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Vy ne sostoite v FBI.";

type FbiDoor = {
  pickup: { x: number; y: number; z: number; interior: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
};

const DOORS: readonly FbiDoor[] = [
  {
    pickup: { x: 607.137, y: -1458.5026, z: 14.3807, interior: 0 },
    dest: {
      x: 238.6755,
      y: 140.5196,
      z: 1003.0234,
      angle: 0.3367,
      interior: FBI_INTERIOR,
      world: STREET_WORLD,
    },
    label: "FBI\nSluzhebnyy vkhod",
    staffOnly: true,
  },
  {
    pickup: { x: 238.5941, y: 138.995, z: 1003.0234, interior: FBI_INTERIOR },
    dest: {
      x: 610.2761,
      y: -1458.6161,
      z: 14.378,
      angle: 269.6083,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Vykhod na ulicu",
    staffOnly: true,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindFbiDoors(): void {
  for (const door of DOORS) {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z,
      STREET_WORLD
    );
    new TextLabel(
      door.label,
      Color.info,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );
  }

  setInterval(tickFbiDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickFbiDoors(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (player.getVirtualWorld() !== STREET_WORLD) {
        return;
      }

      const interior = player.getInterior();
      const pos = player.getPos();
      for (const door of DOORS) {
        if (interior !== door.pickup.interior) {
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

function tryUse(player: Player, door: FbiDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Vam nuzhno lechenie. Zanimite koyku: /hospital.");
      return;
    }

    const membership = account ? getMembership(account) : null;
    if (!membership || membership.org.id !== ORG_FBI_ID) {
      deny(player, DENY);
      return;
    }
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
