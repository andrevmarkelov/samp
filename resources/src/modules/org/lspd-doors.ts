import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { LAW_ORG_IDS, LSPD_INTERIOR } from "./lspd";
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
const DENY = "Открыть могут сотрудники LSPD, областной полиции и FBI.";

type LspdDoor = {
  pickup: { x: number; y: number; z: number; interior: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
};

const DOORS: readonly LspdDoor[] = [
  {
    pickup: { x: 1555.1888, y: -1675.5829, z: 16.1953, interior: 0 },
    dest: {
      x: 246.0688,
      y: 108.9703,
      z: 1003.2188,
      angle: 0,
      interior: LSPD_INTERIOR,
      world: STREET_WORLD,
    },
    label: "LSPD\nВход",
    staffOnly: false,
  },
  {
    pickup: { x: 246.3908, y: 107.4583, z: 1003.2188, interior: LSPD_INTERIOR },
    dest: {
      x: 1552.6929,
      y: -1675.5747,
      z: 16.1953,
      angle: 91.0569,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: false,
  },
  {
    pickup: { x: 214.1955, y: 120.771, z: 999.0156, interior: LSPD_INTERIOR },
    dest: {
      x: 1527.4255,
      y: -1677.9736,
      z: 5.8906,
      angle: 269.8995,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Гараж\nСлужебный выход",
    staffOnly: true,
  },
  {
    pickup: { x: 1524.7473, y: -1677.832, z: 5.8906, interior: 0 },
    dest: {
      x: 216.286,
      y: 120.5165,
      z: 999.0156,
      angle: 267.6828,
      interior: LSPD_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Гараж\nСлужебный вход",
    staffOnly: true,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindLspdDoors(): void {
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

  setInterval(tickLspdDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickLspdDoors(): void {
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

function tryUse(player: Player, door: LspdDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
      return;
    }

    const membership = account ? getMembership(account) : null;
    const orgId = membership?.org.id;
    if (orgId === undefined || !(LAW_ORG_IDS as readonly number[]).includes(orgId)) {
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
