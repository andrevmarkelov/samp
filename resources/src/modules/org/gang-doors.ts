import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import {
  AZTECAS_WORLD,
  BALLAS_WORLD,
  GROVE_WORLD,
  RIFA_WORLD,
  VAGOS_WORLD,
} from "./gangs";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

type GangDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
};

function hqDoors(input: {
  enterLabel: string;
  world: number;
  interior: number;
  streetPickup: { x: number; y: number; z: number };
  streetExit: SpawnPoint;
  insidePickup: { x: number; y: number; z: number };
  insideEnter: SpawnPoint;
}): GangDoor[] {
  return [
    {
      pickup: {
        x: input.streetPickup.x,
        y: input.streetPickup.y,
        z: input.streetPickup.z,
        interior: 0,
        world: STREET_WORLD,
      },
      dest: { ...input.insideEnter, interior: input.interior, world: input.world },
      label: input.enterLabel,
    },
    {
      pickup: {
        x: input.insidePickup.x,
        y: input.insidePickup.y,
        z: input.insidePickup.z,
        interior: input.interior,
        world: input.world,
      },
      dest: input.streetExit,
      label: "Выход на улицу",
    },
  ];
}

const DOORS: readonly GangDoor[] = [
  ...hqDoors({
    enterLabel: "Grove Street\nВход",
    world: GROVE_WORLD,
    interior: 2,
    streetPickup: { x: 2514.0725, y: -1691.3683, z: 14.046 },
    streetExit: {
      x: 2511.5591,
      y: -1689.1527,
      z: 13.5457,
      angle: 46.9,
      interior: 0,
      world: STREET_WORLD,
    },
    insidePickup: { x: 2468.771, y: -1698.3153, z: 1013.5078 },
    insideEnter: { x: 2466.3977, y: -1698.2695, z: 1013.5078, angle: 89.5907, interior: 2, world: GROVE_WORLD },
  }),
  ...hqDoors({
    enterLabel: "Ballas\nВход",
    world: BALLAS_WORLD,
    interior: 4,
    streetPickup: { x: 2022.8706, y: -1120.2635, z: 26.421 },
    streetExit: {
      x: 2023.0149,
      y: -1123.6508,
      z: 26.1405,
      angle: 181.3213,
      interior: 0,
      world: STREET_WORLD,
    },
    insidePickup: { x: 221.8745, y: 1140.5535, z: 1082.6094 },
    insideEnter: { x: 221.8294, y: 1141.7898, z: 1082.6094, angle: 359.7336, interior: 4, world: BALLAS_WORLD },
  }),
  ...hqDoors({
    enterLabel: "Vagos\nВход",
    world: VAGOS_WORLD,
    interior: 5,
    streetPickup: { x: 2756.2834, y: -1182.8099, z: 69.4035 },
    streetExit: {
      x: 2756.2915,
      y: -1180.36,
      z: 69.3984,
      angle: 0.2371,
      interior: 0,
      world: STREET_WORLD,
    },
    insidePickup: { x: 318.6151, y: 1114.6393, z: 1083.8828 },
    insideEnter: { x: 318.6287, y: 1116.5457, z: 1083.8828, angle: 359.06, interior: 5, world: VAGOS_WORLD },
  }),
  ...hqDoors({
    enterLabel: "Rifa\nВход",
    world: RIFA_WORLD,
    interior: 6,
    streetPickup: { x: 2787.074, y: -1926.1321, z: 13.5469 },
    streetExit: {
      x: 2784.4299,
      y: -1926.2025,
      z: 13.5469,
      angle: 91.1038,
      interior: 0,
      world: STREET_WORLD,
    },
    insidePickup: { x: -68.8425, y: 1351.3694, z: 1080.2109 },
    insideEnter: { x: -68.8442, y: 1353.2507, z: 1080.2109, angle: 1.2767, interior: 6, world: RIFA_WORLD },
  }),
  ...hqDoors({
    enterLabel: "Aztecas\nВход",
    world: AZTECAS_WORLD,
    interior: 2,
    streetPickup: { x: 2185.8184, y: -1815.228, z: 13.5469 },
    streetExit: {
      x: 2185.7834,
      y: -1812.2452,
      z: 13.5549,
      angle: 359.9451,
      interior: 0,
      world: STREET_WORLD,
    },
    insidePickup: { x: 226.4637, y: 1239.9911, z: 1082.1406 },
    insideEnter: { x: 224.2814, y: 1239.9761, z: 1082.1406, angle: 89.3008, interior: 2, world: AZTECAS_WORLD },
  }),
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();
const standingOn = new Map<number, GangDoor>();

export function bindGangDoors(): void {
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

  setInterval(tickGangDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickGangDoors(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(id);
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
          if (standingOn.get(id) === door) {
            return;
          }

          tryUse(player, door.dest);
          return;
        }
      }

      standingOn.delete(id);
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
    markStandingPickup(id, point);
  } catch {
    // Игрок уже вышел.
  }
}

function markStandingPickup(id: number, pos: SpawnPoint): void {
  for (const door of DOORS) {
    if (door.pickup.world !== pos.world || door.pickup.interior !== pos.interior) {
      continue;
    }

    if (near(pos, door.pickup)) {
      standingOn.set(id, door);
      return;
    }
  }

  standingOn.delete(id);
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
    standingOn.delete(id);
  }
}
