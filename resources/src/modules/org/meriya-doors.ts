import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { CITY_HALL_INTERIOR, ORG_MERIYA_ID } from "./meriya";
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
const DENY = "Вы не состоите в мэрии.";

type StaffDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
};

const DOORS: readonly StaffDoor[] = [
  {
    pickup: {
      x: 1413.0294,
      y: -1790.4906,
      z: 15.4356,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: 366.8912,
      y: 194.0827,
      z: 1008.3828,
      angle: 90.3365,
      interior: CITY_HALL_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Мэрия\nСлужебный вход",
  },
  {
    pickup: {
      x: 368.4198,
      y: 194.0984,
      z: 1008.3828,
      interior: CITY_HALL_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 1408.3652,
      y: -1790.3862,
      z: 13.5469,
      angle: 88.0725,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Парковка\nСлужебный выход",
  },
  {
    pickup: {
      x: 350.1312,
      y: 178.0575,
      z: 1014.1875,
      interior: CITY_HALL_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 1445.2192,
      y: -1804.9155,
      z: 33.4297,
      angle: 182.0736,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Мэрия\nКрыша",
  },
  {
    pickup: {
      x: 1445.2548,
      y: -1803.027,
      z: 33.4297,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: 350.1312,
      y: 179.9575,
      z: 1014.1875,
      angle: 1.3958,
      interior: CITY_HALL_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Мэрия\nС крыши",
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindMeriyaStaffDoors(): void {
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

      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      const pos = player.getPos();
      for (const door of DOORS) {
        if (world !== door.pickup.world || interior !== door.pickup.interior) {
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
  if (!membership || membership.org.id !== ORG_MERIYA_ID) {
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
