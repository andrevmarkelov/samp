import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { ORG_ARMY_ID } from "./army";
import { ORG_FBI_ID } from "./fbi";
import { ORG_LSPD_ID } from "./lspd";
import { getMembership } from "./membership";
import { ORG_POLICE_ID } from "./police";

/** Совпадает с MapVirtualWorld в maps/army_hq.txt. Объекты карты в interior 10. */
export const ARMY_HQ_WORLD = 19;
export const ARMY_HQ_INTERIOR = 10;

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Войти могут сотрудники Армии, ФБР и полиции.";
const ALLOWED = [ORG_ARMY_ID, ORG_FBI_ID, ORG_POLICE_ID, ORG_LSPD_ID] as const;

type HqDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
  staffOnly: boolean;
};

const DOORS: readonly HqDoor[] = [
  {
    pickup: {
      x: 2731.6133,
      y: -2417.3689,
      z: 13.6279,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: 2578.4233,
      y: 2192.4863,
      z: 1046.9365,
      angle: 89.6415,
      interior: ARMY_HQ_INTERIOR,
      world: ARMY_HQ_WORLD,
    },
    label: "Штаб армии\nВход",
    staffOnly: true,
  },
  {
    pickup: {
      x: 2580.9385,
      y: 2192.4512,
      z: 1046.9353,
      interior: ARMY_HQ_INTERIOR,
      world: ARMY_HQ_WORLD,
    },
    dest: {
      x: 2731.6399,
      y: -2415.1299,
      z: 13.6328,
      angle: 359.5368,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: false,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindArmyHqDoors(): void {
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

  setInterval(tickHqDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickHqDoors(): void {
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

function tryUse(player: Player, door: HqDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
      return;
    }

    const orgId = account ? getMembership(account)?.org.id : undefined;
    if (orgId === undefined || !(ALLOWED as readonly number[]).includes(orgId)) {
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
  return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= PICKUP_RADIUS;
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
  }
}
