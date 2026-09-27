import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { endArmyFactoryShift, isArmyFactoryOnShift } from "../army-factory";
import { ARMY_FACTORY_INTERIOR, ARMY_FACTORY_WORLD } from "../army-factory/points";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { ORG_ARMY_ID } from "./army";
import { ORG_FBI_ID } from "./fbi";
import { getMembership } from "./membership";

/** Реэкспорт для остального кода органов. */
export { ARMY_FACTORY_INTERIOR, ARMY_FACTORY_WORLD };

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY = "Войти могут сотрудники Армии и FBI.";
const ALLOWED = [ORG_ARMY_ID, ORG_FBI_ID] as const;

type FactoryDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
  /** false = выход, проверка органа не нужна */
  staffOnly: boolean;
};

const DOORS: readonly FactoryDoor[] = [
  {
    pickup: {
      x: 2755.6323,
      y: -2515.5427,
      z: 13.6397,
      interior: 0,
      world: STREET_WORLD,
    },
    dest: {
      x: 2568.522,
      y: -1301.8516,
      z: 1044.125,
      angle: 91.7842,
      interior: ARMY_FACTORY_INTERIOR,
      world: ARMY_FACTORY_WORLD,
    },
    label: "Завод\nВход",
    staffOnly: true,
  },
  {
    pickup: {
      x: 2570.7156,
      y: -1301.9183,
      z: 1044.125,
      interior: ARMY_FACTORY_INTERIOR,
      world: ARMY_FACTORY_WORLD,
    },
    dest: {
      x: 2757.9089,
      y: -2515.5085,
      z: 13.6423,
      angle: 270.4094,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на базу",
    staffOnly: false,
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindArmyFactoryDoors(): void {
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

  setInterval(tickFactoryDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickFactoryDoors(): void {
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

function tryUse(player: Player, door: FactoryDoor): void {
  if (door.staffOnly) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
      return;
    }

    const membership = account ? getMembership(account) : null;
    const orgId = membership?.org.id;
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
    // Выход на улицу: смена в цехе закрывается с выплатой.
    if (point.interior === 0 && isArmyFactoryOnShift(player)) {
      endArmyFactoryShift(player);
    }

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
