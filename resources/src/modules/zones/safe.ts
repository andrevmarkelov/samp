import { omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { trustArmour, trustHealth } from "../anticheat/trust";
import { applyHealth, getAccount, isAuthenticated, MAX_HEALTH } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;
const KEY_FIRE = 4;
const ANIM_SYNC_ALL = 1;
const SNAPSHOT_MS = 200;

type Rect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Невидимые сейф-зоны: без GangZone, без текста, без иконки. */
const SAFE_ZONES: readonly Rect[] = [
  { minX: 1684, minY: -1954.5, maxX: 1816, maxY: -1819.5 },
  { minX: 1393, minY: -1763.5, maxX: 1565, maxY: -1721.5 },
  { minX: 1151, minY: -1388.5, maxX: 1251, maxY: -1288.5 },
  { minX: 1003, minY: -458.5, maxX: 1127, maxY: -283.5 },
  { minX: 655.8, minY: -1447.9, maxX: 784.8, maxY: -1401.9 },
];

type Vitals = {
  hp: number;
  armor: number;
};

const lastVitals = new Map<number, Vitals>();

export function isInSafeZone(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return pointInSafeZone(pos.x, pos.y);
  } catch {
    return false;
  }
}

export function isSafeZoneDamage(victim: Player, from?: Player): boolean {
  if (isInSafeZone(victim)) {
    return true;
  }

  return !!from && isInSafeZone(from);
}

export function startSafeZones(): void {
  setInterval(snapshotAll, SNAPSHOT_MS);

  omp.on("playerConnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      lastVitals.delete(id);
    }
  });

  omp.on("playerSpawn", (player) => {
    if (!isAuthenticated(player)) {
      return;
    }

    rememberVitals(player);
    preloadTired(player);
  });

  omp.on("playerDeath", (player) => {
    const id = playerId(player);
    if (id !== null) {
      lastVitals.delete(id);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      lastVitals.delete(id);
    }
  });

  omp.on("playerTakeDamage", (player, from, amount) => {
    if (!isSafeZoneDamage(player, from)) {
      return;
    }

    restoreVitals(player, Number(amount));
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_FIRE) === 0) {
      return;
    }

    if (!isInSafeZone(player) || !canPlayTired(player)) {
      return;
    }

    playTired(player);
  });
}

function pointInSafeZone(x: number, y: number): boolean {
  for (const zone of SAFE_ZONES) {
    if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) {
      return true;
    }
  }

  return false;
}

function snapshotAll(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    rememberVitals(player);
  });
}

function rememberVitals(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    const state = player.getState();
    if (state === PLAYER_STATE_WASTED || state === PLAYER_STATE_SPECTATING) {
      lastVitals.delete(id);
      return;
    }

    const hp = player.getHealth();
    if (hp <= 0) {
      lastVitals.delete(id);
      return;
    }

    lastVitals.set(id, {
      hp,
      armor: Math.max(0, player.getArmor()),
    });
  } catch {
    // Игрок уже вышел.
  }
}

function restoreVitals(player: Player, amount: number): void {
  const id = playerId(player);
  const saved = id !== null ? lastVitals.get(id) : undefined;
  const savedHp = saved && saved.hp > 0 ? saved : null;

  try {
    if (savedHp) {
      player.setHealth(savedHp.hp);
      player.setArmor(savedHp.armor);
      trustHealth(player, savedHp.hp);
      trustArmour(player, savedHp.armor);
      return;
    }

    const account = getAccount(player);
    if (account) {
      applyHealth(player, account.health);
      return;
    }

    const live = player.getHealth();
    if (live > 0) {
      const next = Math.min(MAX_HEALTH, live + Math.max(0, amount));
      player.setHealth(next);
      trustHealth(player, next);
    }
  } catch {
    // Игрок уже вышел.
  }
}

function canPlayTired(player: Player): boolean {
  try {
    if (player.isInAnyVehicle()) {
      return false;
    }

    return player.getState() === PLAYER_STATE_ONFOOT;
  } catch {
    return false;
  }
}

function playTired(player: Player): void {
  try {
    player.applyAnimation("FAT", "IDLE_tired", 4.1, false, false, false, false, 0, ANIM_SYNC_ALL);
  } catch {
    // Анимация не проигралась.
  }
}

function preloadTired(player: Player): void {
  try {
    player.applyAnimation("FAT", "IDLE_tired", 4.1, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Подтянется при первом ударе.
  }
}
