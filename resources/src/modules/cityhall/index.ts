import { Actor, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { isAuthenticated } from "../auth/session";
import { isPlayerActive, playerId } from "../../shared/player";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import type { GameModule } from "../types";
import { saveUserPassport } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const MAP_ICON_SLOT = 1;
const MAP_ICON_TYPE = 19;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const CITY_HALL_INTERIOR = 3;

const STREET_PICKUP = {
  x: 1481.0596,
  y: -1771.962,
  z: 18.7958,
} as const;

const INTERIOR_PICKUP = {
  x: 389.993,
  y: 173.8064,
  z: 1008.3828,
} as const;

const FROM_STREET: SpawnPoint = {
  x: 387.926,
  y: 173.7338,
  z: 1008.3828,
  angle: 89.0833,
  interior: CITY_HALL_INTERIOR,
  world: STREET_WORLD,
};

const FROM_INTERIOR: SpawnPoint = {
  x: 1481.1135,
  y: -1769.0331,
  z: 18.7958,
  angle: 359.7117,
  interior: 0,
  world: STREET_WORLD,
};

const PASSPORT_PICKUP = {
  x: 358.5322,
  y: 168.9705,
  z: 1008.3828,
} as const;
const PASSPORT_PICKUP_MODEL = 1581;
const PASSPORT_MSG_COOLDOWN_MS = 3000;
const PASSPORT_CLERK_SKIN = 141;
const PASSPORT_CLERK = {
  x: 356.2971,
  y: 168.9869,
  z: 1008.3762,
  angle: 268.6251,
} as const;

const lastTeleportAt = new Map<number, number>();
const lastPassportMsgAt = new Map<number, number>();
const iconShown = new Set<number>();

export const cityHallModule: GameModule = {
  name: "cityhall",
  start() {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z,
      STREET_WORLD
    );
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z,
      STREET_WORLD
    );

    new TextLabel(
      "Мэрия\nВход",
      Color.info,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );
    new TextLabel(
      "Выход на улицу",
      Color.info,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    new Pickup(
      PASSPORT_PICKUP_MODEL,
      PICKUP_TYPE,
      PASSPORT_PICKUP.x,
      PASSPORT_PICKUP.y,
      PASSPORT_PICKUP.z,
      STREET_WORLD
    );

    new TextLabel(
      "Получить паспорт",
      Color.info,
      PASSPORT_PICKUP.x,
      PASSPORT_PICKUP.y,
      PASSPORT_PICKUP.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    spawnPassportClerk();

    setInterval(tickCityHall, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        lastTeleportAt.delete(id);
        lastPassportMsgAt.delete(id);
        iconShown.delete(id);
      }
    });
  },
};

function spawnPassportClerk(): void {
  const actor = new Actor(
    PASSPORT_CLERK_SKIN,
    PASSPORT_CLERK.x,
    PASSPORT_CLERK.y,
    PASSPORT_CLERK.z,
    PASSPORT_CLERK.angle
  );
  actor.setVirtualWorld(STREET_WORLD);
  actor.setInvulnerable(true);

  new TextLabel(
    "Паспортистка\nВыдача документов",
    Color.info,
    PASSPORT_CLERK.x,
    PASSPORT_CLERK.y,
    PASSPORT_CLERK.z + 1.15,
    LABEL_DRAW_DISTANCE,
    STREET_WORLD,
    false
  );
}

function tickCityHall(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      const state = player.getState();
      updateIcon(player, pos.x, pos.y, world, interior);

      if (state !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (
        world === STREET_WORLD &&
        interior === 0 &&
        distance3d(pos.x, pos.y, pos.z, STREET_PICKUP.x, STREET_PICKUP.y, STREET_PICKUP.z) <=
          PICKUP_RADIUS
      ) {
        teleport(player, FROM_STREET);
        return;
      }

      if (
        world === STREET_WORLD &&
        interior === CITY_HALL_INTERIOR &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          INTERIOR_PICKUP.x,
          INTERIOR_PICKUP.y,
          INTERIOR_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        teleport(player, FROM_INTERIOR);
        return;
      }

      if (
        world === STREET_WORLD &&
        interior === CITY_HALL_INTERIOR &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          PASSPORT_PICKUP.x,
          PASSPORT_PICKUP.y,
          PASSPORT_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        tryGivePassport(player);
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
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

  const near =
    world === STREET_WORLD &&
    interior === 0 &&
    distance2d(x, y, STREET_PICKUP.x, STREET_PICKUP.y) <= ICON_RADIUS;

  if (near) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        STREET_PICKUP.x,
        STREET_PICKUP.y,
        STREET_PICKUP.z,
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

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
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
  } catch {
    // Игрок уже вышел.
  }
}

function tryGivePassport(player: Player): void {
  const id = playerId(player);
  const account = getAccount(player);
  if (id === null || !account) {
    return;
  }

  const now = Date.now();
  const last = lastPassportMsgAt.get(id) ?? 0;
  if (now - last < PASSPORT_MSG_COOLDOWN_MS) {
    return;
  }

  lastPassportMsgAt.set(id, now);

  if (account.passport) {
    player.sendClientMessage(Color.gray, "У вас уже есть паспорт.");
    return;
  }

  patchAccount(player, { passport: true });
  void saveUserPassport(account.id).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить паспорт ${account.name}: ${message}`);
  });

  player.sendClientMessage(Color.info, "Вы получили паспорт Los Santos.");
  player.sendClientMessage(
    Color.gray,
    "/pass — посмотреть, /pass [id] — показать другому."
  );
}
