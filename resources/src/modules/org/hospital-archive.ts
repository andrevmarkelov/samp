import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { HOSPITAL_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { ORG_FBI_ID } from "./fbi";
import { ORG_HOSPITAL_ID } from "./hospital";
import { getMembership } from "./membership";

/** Левый ALT (KEY_WALK). */
const KEY_WALK = 1024;
const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Вход только для сотрудников Больницы и FBI.";

const ALLOWED_ORGS: ReadonlySet<number> = new Set([ORG_HOSPITAL_ID, ORG_FBI_ID]);

type ArchiveDoor = {
  pickup: { x: number; y: number; z: number };
  dest: SpawnPoint;
  label: string;
};

/** Холл → архивная / архивная → холл (VW больницы, interior 0). */
const DOORS: readonly ArchiveDoor[] = [
  {
    pickup: { x: 1163.472, y: -1330.9196, z: 4001.1001 },
    dest: {
      x: 1161.6693,
      y: -1330.9052,
      z: 4001.1001,
      angle: 267.9502,
      interior: 0,
      world: HOSPITAL_WORLD,
    },
    label: "Архивная",
  },
  {
    pickup: { x: 1161.6693, y: -1330.9052, z: 4001.1001 },
    dest: {
      x: 1163.472,
      y: -1330.9196,
      z: 4001.1001,
      angle: 88.3359,
      interior: 0,
      world: HOSPITAL_WORLD,
    },
    label: "Выход",
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindHospitalArchive(): void {
  for (const door of DOORS) {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z,
      HOSPITAL_WORLD
    );
    new TextLabel(
      door.label,
      Color.info,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      HOSPITAL_WORLD,
      false
    );
  }

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_WALK) === 0) {
      return;
    }

    tryUse(player);
  });

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });

  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tryUse(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  let door: ArchiveDoor | null = null;
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }

    if (player.getVirtualWorld() !== HOSPITAL_WORLD || player.getInterior() !== 0) {
      return;
    }

    const pos = player.getPos();
    let bestDist = PICKUP_RADIUS;
    for (const item of DOORS) {
      const dist = Math.hypot(
        pos.x - item.pickup.x,
        pos.y - item.pickup.y,
        pos.z - item.pickup.z
      );
      if (dist <= bestDist) {
        bestDist = dist;
        door = item;
      }
    }
  } catch {
    return;
  }

  if (!door) {
    return;
  }

  const account = getAccount(player);
  if (account?.hospitalized) {
    deny(player, "Вам нужно лечение. Займите койку: /hospital.");
    return;
  }

  const membership = account ? getMembership(account) : null;
  if (!membership || !ALLOWED_ORGS.has(membership.org.id)) {
    deny(player, DENY);
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
    placeAt(player, point, { settleMs: false });
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
  }
}
