import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import {
  HOSPITAL_WORLD,
  STREET_WORLD,
  placeAt,
  type SpawnPoint,
} from "../spawn/point";
import { ORG_HOSPITAL_ID } from "./hospital";
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
const DENY = "Вы не состоите в больнице.";

type StaffDoor = {
  pickup: { x: number; y: number; z: number; world: number };
  dest: SpawnPoint;
  label: string;
};

const DOORS: readonly StaffDoor[] = [
  {
    pickup: { x: 1149.5529, y: -1333.4094, z: 19.392, world: STREET_WORLD },
    dest: {
      x: 1161.5374,
      y: -1327.8872,
      z: 31.5,
      angle: 0.9078,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Парковка\nНа крышу",
  },
  {
    pickup: { x: 1161.5471, y: -1330.0697, z: 31.4935, world: STREET_WORLD },
    dest: {
      x: 1147.2316,
      y: -1333.2146,
      z: 19.3198,
      angle: 85.8219,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Крыша\nНа парковку",
  },
  {
    pickup: { x: 1147.801, y: -1317.7454, z: 13.6535, world: STREET_WORLD },
    dest: {
      x: 1613.2654,
      y: 1801.5596,
      z: -20.7585,
      angle: 90.0208,
      interior: 0,
      world: HOSPITAL_WORLD,
    },
    label: "Больница\nВход",
  },
  {
    pickup: { x: 1615.3278, y: 1801.5503, z: -20.7585, world: HOSPITAL_WORLD },
    dest: {
      x: 1147.804,
      y: -1315.7272,
      z: 13.6782,
      angle: 359.3254,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на парковку",
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindHospitalRoofAccess(): void {
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

  setInterval(tickStaffDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });

  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickStaffDoors(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (player.getInterior() !== 0) {
        return;
      }

      const world = player.getVirtualWorld();
      const pos = player.getPos();
      for (const door of DOORS) {
        if (world !== door.pickup.world) {
          continue;
        }

        if (near(pos, door.pickup)) {
          tryUse(player, door.dest);
          return;
        }
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryUse(player: Player, dest: SpawnPoint): void {
  const account = getAccount(player);
  if (account?.hospitalized) {
    deny(player, "Вам нужно лечение. Займите койку: /hospital.");
    return;
  }

  const membership = account ? getMembership(account) : null;
  if (!membership || membership.org.id !== ORG_HOSPITAL_ID) {
    deny(player, DENY);
    return;
  }

  teleport(player, dest);
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
