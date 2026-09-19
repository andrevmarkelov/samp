import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { assignStreamWorld, refreshStreamForPlayer } from "../mapping/stream";
import { LAW_ORG_IDS } from "../org/lspd";
import { getMembership } from "../org/membership";
import { bindPrisonControl, isPrisonYardOpen } from "./control";
import { bindPrisonLocker } from "./prison-locker";
import { PRISON_WORLD, PRISON_YARD_WORLD, STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import type { GameModule } from "../types";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Otkryt' mogut sotrudniki LSPD, oblastnoy policii i FBI.";

const POINT = {
  x: 1810.8636,
  y: -1576.4412,
  z: 13.5167,
} as const;

const MAP_ICON_SLOT = 4;
const MAP_ICON_TYPE = 30;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;

type PrisonDoor = {
  pickup: { x: number; y: number; z: number; world: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
  liveLabel?: boolean;
};

const DOORS: readonly PrisonDoor[] = [
  {
    pickup: { x: 1797.8708, y: -1578.7859, z: 14.0898, world: STREET_WORLD },
    dest: {
      x: -95.7596,
      y: 2446.2253,
      z: 1179.3195,
      angle: 179.0484,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Tyurma",
    staffOnly: true,
  },
  {
    pickup: { x: -95.7041, y: 2448.5913, z: 1179.3195, world: PRISON_WORLD },
    dest: {
      x: 1800.3523,
      y: -1578.6176,
      z: 14.0744,
      angle: 274.9058,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Vykhod na ulicu",
    staffOnly: true,
  },
  {
    pickup: { x: -101.0865, y: 2440.259, z: 1179.3196, world: PRISON_WORLD },
    dest: {
      x: -92.9794,
      y: 2437.1223,
      z: 1179.3195,
      angle: 180.2859,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Tyuremnye kamery",
    staffOnly: false,
  },
  {
    pickup: { x: -92.9113, y: 2439.0156, z: 1179.3195, world: PRISON_WORLD },
    dest: {
      x: -101.1068,
      y: 2441.948,
      z: 1179.3196,
      angle: 2.3342,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Vykhod\nKukhnya\nKomnata dezhurnogo\nKomnata ohrany",
    staffOnly: false,
  },
  {
    pickup: { x: -58.4486, y: 2435.0085, z: 1179.3195, world: PRISON_WORLD },
    dest: {
      x: 1770.9084,
      y: -1546.7561,
      z: 9.9224,
      angle: 41.5168,
      interior: 0,
      world: PRISON_YARD_WORLD,
    },
    label: "Tyuremnyy dvor",
    staffOnly: false,
    liveLabel: true,
  },
  {
    pickup: { x: 1772.1851, y: -1548.3082, z: 9.9063, world: PRISON_YARD_WORLD },
    dest: {
      x: -60.3588,
      y: 2435.0315,
      z: 1179.3195,
      angle: 91.0083,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Tyuremnye kamery",
    staffOnly: false,
  },
  {
    pickup: { x: -92.9455, y: 2430.6094, z: 1179.3195, world: PRISON_WORLD },
    dest: {
      x: -101.4222,
      y: 2425.0925,
      z: 1179.3196,
      angle: 270.1877,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Sportzal",
    staffOnly: false,
  },
  {
    pickup: { x: -103.0649, y: 2425.1497, z: 1179.3196, world: PRISON_WORLD },
    dest: {
      x: -92.9226,
      y: 2432.2656,
      z: 1179.3195,
      angle: 359.2009,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Tyuremnye kamery",
    staffOnly: false,
  },
  {
    pickup: { x: -103.0942, y: 2447.4717, z: 1179.3196, world: PRISON_WORLD },
    dest: {
      x: -104.3588,
      y: 2431.4629,
      z: 1179.3196,
      angle: 356.7856,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Kukhnya",
    staffOnly: false,
  },
  {
    pickup: { x: -104.4458, y: 2430.5073, z: 1179.3196, world: PRISON_WORLD },
    dest: {
      x: -101.5762,
      y: 2447.4695,
      z: 1179.3196,
      angle: 271.4878,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Komnata dezhurnogo",
    staffOnly: false,
  },
  {
    pickup: { x: -90.1222, y: 2444.7705, z: 1179.3195, world: PRISON_WORLD },
    dest: {
      x: -107.1339,
      y: 2436.3723,
      z: 1186.3364,
      angle: 270.7183,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Komnata ohrany",
    staffOnly: true,
  },
  {
    pickup: { x: -108.4159, y: 2436.3604, z: 1186.3364, world: PRISON_WORLD },
    dest: {
      x: -91.3801,
      y: 2444.8391,
      z: 1179.3195,
      angle: 88.4267,
      interior: 0,
      world: PRISON_WORLD,
    },
    label: "Komnata dezhurnogo",
    staffOnly: true,
  },
];

const INTERIOR_MAP = {
  minX: -125,
  maxX: -50,
  minY: 2380,
  maxY: 2455,
  minZ: 1170,
  maxZ: 1200,
} as const;

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();
const iconShown = new Set<number>();
const onPickup = new Set<number>();

export const prisonModule: GameModule = {
  name: "prison",
  start() {
    assignStreamWorld(PRISON_WORLD, isPrisonInteriorObject);
    bindPrisonLocker();
    bindPrisonControl();

    for (const door of DOORS) {
      new Pickup(
        PICKUP_MODEL,
        PICKUP_TYPE,
        door.pickup.x,
        door.pickup.y,
        door.pickup.z,
        door.pickup.world
      );
      if (door.liveLabel) {
        continue;
      }

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

    setInterval(tickPrison, TICK_MS);

    omp.on("playerConnect", (player) => {
      clearPlayer(player);
    });
    omp.on("playerDisconnect", (player) => {
      clearPlayer(player);
    });
  },
};

function tickPrison(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      updateIcon(player, pos.x, pos.y, world, interior);

      if (player.getState() !== PLAYER_STATE_ONFOOT || interior !== 0) {
        onPickup.delete(id);
        return;
      }

      for (const door of DOORS) {
        if (world !== door.pickup.world) {
          continue;
        }

        if (near(pos, door.pickup)) {
          if (!onPickup.has(id)) {
            onPickup.add(id);
            tryUse(player, door);
          }
          return;
        }
      }

      onPickup.delete(id);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryUse(player: Player, door: PrisonDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Vam nuzhno lechenie. Zanimite koyku: /hospital.");
      return;
    }

    const membership = account ? getMembership(account) : null;
    const orgId = membership?.org.id;
    if (orgId === undefined || !(LAW_ORG_IDS as readonly number[]).includes(orgId)) {
      deny(player, DENY);
      return;
    }
  }

  if (door.dest.world === PRISON_YARD_WORLD && !isPrisonYardOpen()) {
    deny(player, "Dvor zakryt.");
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

function isPrisonInteriorObject(object: { x: number; y: number; z: number }): boolean {
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

  const nearStreet =
    world === STREET_WORLD &&
    interior === 0 &&
    Math.hypot(x - POINT.x, y - POINT.y) <= ICON_RADIUS;

  if (nearStreet) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        POINT.x,
        POINT.y,
        POINT.z,
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
    iconShown.delete(id);
    onPickup.delete(id);
  }
}
