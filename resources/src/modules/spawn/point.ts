import type { Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { trustPosition } from "../anticheat/trust";

export type SpawnPoint = {
  x: number;
  y: number;
  z: number;
  angle: number;
  interior: number;
  world: number;
};

export type PlaceAtOptions = {
  /**
   * мс заморозки после телепорта (прогрузка коллизий/текстур).
   * `false` — не замораживать. По умолчанию: interior>0 или не улица → 2500 мс.
   */
  settleMs?: number | false;
};

export const NO_TEAM = 255;

/** Скин для class-селектора, если у игрока ещё нет аккаунта. */
export const DEFAULT_SPAWN_SKIN = 26;

export const STREET_WORLD = 0;

/** Пауза после входа в интерьер / кастомный VW, пока подтянутся объекты. */
export const INTERIOR_SETTLE_MS = 2500;

/** Отдельный VW больницы: игроки и пикапы внутри не пересекаются с улицей. */
export const HOSPITAL_WORLD = 1;

/** Отдельный VW тюрьмы: интерьер в небе не пересекается с улицей. Банк = 2. */
export const PRISON_WORLD = 3;

/** Двор тюрьмы на координатах участка: игроки не пересекаются с улицей. */
export const PRISON_YARD_WORLD = 4;

/** Мафии (интерьер 5): LCN VW 14, Yakuza 15, Русская 16 — `org/mafias.ts`. */
/** Банды (дома): Grove VW 9, Ballas 10, Vagos 11, Rifa 12, Aztecas 13 — `org/gangs.ts`. */
/** Радиоцентр (кастомный интерьер): VW 8 — `org/radio.ts`. */
/** Мэрия (кастомный интерьер): VW 3 (= org id) — `org/meriya.ts`. Совпадает с PRISON_WORLD; координаты далеко. */

/** Обычный спавн, пока игрок не в организации. */
export const DEFAULT_SPAWN: SpawnPoint = {
  x: 1760.2538,
  y: -1898.8334,
  z: 13.5629,
  angle: 269.124,
  interior: 0,
  world: STREET_WORLD,
};

export const HOSPITAL_SPAWNS: readonly SpawnPoint[] = [
  {
    x: 1172.5653,
    y: -1344.8042,
    z: 4001.1001,
    angle: 90.5063,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1172.564,
    y: -1354.6053,
    z: 4001.1001,
    angle: 89.9031,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1165.129,
    y: -1361.8331,
    z: 4001.1001,
    angle: 0.9389,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1158.2642,
    y: -1354.5325,
    z: 4001.1001,
    angle: 271.0115,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1157.9478,
    y: -1344.7404,
    z: 4001.1001,
    angle: 270.0948,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
];

const settleTimers = new Map<number, ReturnType<typeof setTimeout>>();
/** Токен активной settle-сессии (просроченный таймер не трогает управление). */
const settleTokens = new Map<number, object>();

export function pickHospitalSpawn(): SpawnPoint {
  const first = HOSPITAL_SPAWNS[0];
  if (!first) {
    return DEFAULT_SPAWN;
  }

  const index = Math.floor(Math.random() * HOSPITAL_SPAWNS.length);
  return HOSPITAL_SPAWNS[index] ?? first;
}

export function writeSpawnInfo(player: Player, skin: number, point: SpawnPoint): void {
  player.setSpawnInfo(
    NO_TEAM,
    skin,
    point.x,
    point.y,
    point.z,
    point.angle,
    0,
    0,
    0,
    0,
    0,
    0
  );
}

export function placeAt(player: Player, point: SpawnPoint, options?: PlaceAtOptions): void {
  // Снимает прошлую settle-заморозку (иначе выход на улицу / новый ТП = вечный лок).
  clearPlaceAtSettle(player);

  player.setInterior(point.interior);
  player.setVirtualWorld(point.world);
  player.setPos(point.x, point.y, point.z);
  player.setFacingAngle(point.angle);
  player.setCameraBehind();
  trustPosition(player, point.x, point.y, point.z, point.interior, point.world);

  const settleMs = resolveSettleMs(point, options);
  if (settleMs <= 0) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    player.toggleControllable(false);
  } catch {
    return;
  }

  const token = {};
  settleTokens.set(id, token);

  settleTimers.set(
    id,
    setTimeout(() => {
      settleTimers.delete(id);
      if (settleTokens.get(id) !== token) {
        return;
      }
      settleTokens.delete(id);

      try {
        if (isPlayerActive(player)) {
          player.toggleControllable(true);
        }
      } catch {
        // Игрок уже вышел.
      }
    }, settleMs)
  );
}

/** Снять отложенную разморозку (дисконнект / новый телепорт). */
export function clearPlaceAtSettle(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const hadSettle = settleTimers.has(id) || settleTokens.has(id);

  const timer = settleTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    settleTimers.delete(id);
  }
  settleTokens.delete(id);

  // Размораживаем только если замораживали мы (не шахта / станок / скин-пикер).
  if (!hadSettle) {
    return;
  }

  try {
    if (isPlayerActive(player)) {
      player.toggleControllable(true);
    }
  } catch {
    // Игрок уже вышел.
  }
}

function resolveSettleMs(point: SpawnPoint, options?: PlaceAtOptions): number {
  if (options?.settleMs === false) {
    return 0;
  }

  if (typeof options?.settleMs === "number") {
    return Math.max(0, options.settleMs);
  }

  // Интерьер или кастомный VW (больница, тюрьма, завод, HQ…) — ждём коллизии.
  if (point.interior > 0 || point.world !== STREET_WORLD) {
    return INTERIOR_SETTLE_MS;
  }

  return 0;
}
