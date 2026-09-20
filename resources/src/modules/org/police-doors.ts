import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { getMembership } from "./membership";
import { LAW_ORG_IDS } from "./lspd";
import { POLICE_INTERIOR } from "./police";

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

type PoliceDoor = {
  pickup: { x: number; y: number; z: number; interior: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
};

const DOORS: readonly PoliceDoor[] = [
  {
    pickup: { x: 626.973, y: -571.7709, z: 17.9207, interior: 0 },
    dest: {
      x: 246.66,
      y: 65.8,
      z: 1003.64,
      angle: 0,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Областная полиция\nВход",
    staffOnly: false,
  },
  {
    pickup: { x: 246.757, y: 62.4475, z: 1003.6406, interior: POLICE_INTERIOR },
    dest: {
      x: 631.6352,
      y: -571.7485,
      z: 16.3359,
      angle: 268.9851,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: false,
  },
  {
    pickup: { x: 611.0726, y: -583.5037, z: 18.2109, interior: 0 },
    dest: {
      x: 245.1678,
      y: 66.2916,
      z: 1003.6406,
      angle: 267.5659,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Парковка\nСлужебный вход",
    staffOnly: true,
  },
  {
    pickup: { x: 242.477, y: 66.3774, z: 1003.6406, interior: POLICE_INTERIOR },
    dest: {
      x: 611.0386,
      y: -586.416,
      z: 17.2266,
      angle: 181.2275,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Парковка\nСлужебный выход",
    staffOnly: true,
  },
  {
    pickup: { x: 621.258, y: -569.2031, z: 26.1432, interior: 0 },
    dest: {
      x: 246.3152,
      y: 86.1715,
      z: 1003.6406,
      angle: 178.2883,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Крыша\nСлужебный вход",
    staffOnly: true,
  },
  {
    pickup: { x: 246.3991, y: 88.0064, z: 1003.6406, interior: POLICE_INTERIOR },
    dest: {
      x: 621.1804,
      y: -571.1289,
      z: 26.1432,
      angle: 178.1175,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Крыша\nСлужебный выход",
    staffOnly: true,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindPoliceDoors(): void {
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

  setInterval(tickPoliceDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickPoliceDoors(): void {
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

function tryUse(player: Player, door: PoliceDoor): void {
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
