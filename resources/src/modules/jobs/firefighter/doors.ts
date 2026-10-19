import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../../shared/colors";
import { isPlayerActive, playerId } from "../../../shared/player";
import { getAccount, isAuthenticated } from "../../auth/session";
import { refreshStreamForPlayer } from "../../mapping/stream";
import { ORG_FBI_ID } from "../../org/fbi";
import { getMembership } from "../../org/membership";
import { ORG_LSPD_ID } from "../../org/lspd";
import { ORG_POLICE_ID } from "../../org/police";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../../spawn/point";
import { JOB_FIREFIGHTER } from "../catalog";

/** Совпадает с MapVirtualWorld в maps/lsfd.txt. Объекты карты в interior 1. */
export const FIRE_STATION_WORLD = 20;
export const FIRE_STATION_INTERIOR = 1;

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Войти могут пожарные, сотрудники полиции и ФБР.";
const LAW_ORGS = [ORG_POLICE_ID, ORG_LSPD_ID, ORG_FBI_ID] as const;

type StationDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
};

const DOORS: readonly StationDoor[] = [
  {
    pickup: {
      x: 1740.0889,
      y: -1456.7771,
      z: 13.5281,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: -272.5693,
      y: 896.419,
      z: -36.824,
      angle: 89.4693,
      interior: FIRE_STATION_INTERIOR,
      world: FIRE_STATION_WORLD,
    },
    label: "Пожарная часть\nВход",
    staffOnly: true,
  },
  {
    pickup: {
      x: -270.3944,
      y: 896.2792,
      z: -36.824,
      interior: FIRE_STATION_INTERIOR,
      world: FIRE_STATION_WORLD,
    },
    dest: {
      x: 1742.7563,
      y: -1456.7786,
      z: 13.519,
      angle: 269.8076,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: false,
  },
  {
    pickup: {
      x: 1732.6049,
      y: -1468.6364,
      z: 33.0234,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: -281.9862,
      y: 898.3176,
      z: -36.8241,
      angle: 270.8912,
      interior: FIRE_STATION_INTERIOR,
      world: FIRE_STATION_WORLD,
    },
    label: "Пожарная часть\nСпуск внутрь",
    staffOnly: true,
  },
  {
    pickup: {
      x: -284.4078,
      y: 898.302,
      z: -36.8241,
      interior: FIRE_STATION_INTERIOR,
      world: FIRE_STATION_WORLD,
    },
    dest: {
      x: 1732.6417,
      y: -1466.2898,
      z: 33.0234,
      angle: 359.7117,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на крышу",
    staffOnly: true,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindFireStationDoors(): void {
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

  setInterval(tickStationDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickStationDoors(): void {
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

function tryUse(player: Player, door: StationDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
      return;
    }

    if (!canEnter(account)) {
      deny(player, DENY);
      return;
    }
  }

  teleport(player, door.dest);
}

function canEnter(account: ReturnType<typeof getAccount>): boolean {
  if (!account) {
    return false;
  }

  if (account.jobId === JOB_FIREFIGHTER) {
    return true;
  }

  const orgId = getMembership(account)?.org.id;
  return orgId !== undefined && (LAW_ORGS as readonly number[]).includes(orgId);
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
  return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= PICKUP_RADIUS;
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
  }
}
