import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserHealth, saveUserHunger, saveUserJailedSeconds, saveUserVitals } from "../auth/repository";
import { trustHealth } from "../anticheat/trust";
import {
  HEALTH_DECAY_AMOUNT,
  HEALTH_DECAY_MS,
  HUNGER_DECAY_AMOUNT,
  HUNGER_WARN_LEVELS,
  MAX_HEALTH,
  MIN_HEALTH,
  VITALS_SAVE_MS,
  applyWallet,
  getAccount,
  isAuthenticated,
  normalizeHunger,
  patchAccount,
} from "../auth/session";
import { isSafeZoneDamage } from "../zones/safe";
import { isBankBusy } from "../bank/tellers";
import type { GameModule } from "../types";

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

const HUNGER_WARN_TEXT: Record<(typeof HUNGER_WARN_LEVELS)[number], string> = {
  40: "Вы проголодались.",
  30: "Вы сильно проголодались.",
  20: "Вы очень голодны. Найдите еду.",
};

/** Какие пороги голода уже показали игроку (чтобы не спамить). */
const hungerWarned = new Map<number, Set<number>>();

function isInWorld(player: Player): boolean {
  try {
    const state = player.getState();
    return (
      state === PLAYER_STATE_ONFOOT ||
      state === PLAYER_STATE_DRIVER ||
      state === PLAYER_STATE_PASSENGER
    );
  } catch {
    return false;
  }
}

function readLiveHealth(player: Player, fallback: number): number {
  try {
    const state = player.getState();
    if (state === PLAYER_STATE_WASTED || state === PLAYER_STATE_SPECTATING) {
      return fallback;
    }

    const health = player.getHealth();
    if (health > 0) {
      return Math.min(MAX_HEALTH, health);
    }
  } catch {
    // Спек, смерть или выход — берём последнее из аккаунта.
  }

  return fallback;
}

function persistJailSeconds(userId: number, seconds: number, name: string): void {
  void saveUserJailedSeconds(userId, seconds).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить срок ${name}: ${message}`);
  });
}

export function queueSave(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  persistJailSeconds(account.id, account.jailSeconds, account.name);

  const health = readLiveHealth(player, account.health);
  const hunger = normalizeHunger(account.hunger);

  if (isBankBusy(player)) {
    patchAccount(player, { health, hunger });
    void saveUserHealth(account.id, health).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] не удалось сохранить HP ${account.name}: ${message}`);
    });
    void saveUserHunger(account.id, hunger).catch(() => {
      // Периодический save подхватит.
    });
    return;
  }
  const money = Math.max(0, Math.floor(account.money));
  const bank = Math.max(0, Math.floor(account.bank));
  patchAccount(player, { health, money, bank, hunger });

  if (isInWorld(player)) {
    applyWallet(player, { ...account, money });
  }

  void saveUserVitals(account.id, health, money, bank, hunger).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить персонажа ${account.name}: ${message}`);
  });
}

function rememberHealth(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const health = readLiveHealth(player, account.health);
  if (health !== account.health) {
    patchAccount(player, { health });
  }
}

function warnHungerIfNeeded(player: Player, prev: number, next: number): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  let shown = hungerWarned.get(slotId);
  if (!shown) {
    shown = new Set();
    hungerWarned.set(slotId, shown);
  }

  for (const level of HUNGER_WARN_LEVELS) {
    if (prev > level && next <= level && !shown.has(level)) {
      shown.add(level);
      player.sendClientMessage(Color.error, HUNGER_WARN_TEXT[level]);
    }
  }

  // Поели — снова можно предупреждать при следующем падении.
  for (const level of HUNGER_WARN_LEVELS) {
    if (next > level) {
      shown.delete(level);
    }
  }
}

/** Сбросить предупреждения о голоде после еды / восстановления. */
export function notifyHungerRestored(player: Player, hunger: number): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const shown = hungerWarned.get(slotId);
  if (!shown) {
    return;
  }

  const level = normalizeHunger(hunger);
  for (const warn of HUNGER_WARN_LEVELS) {
    if (level > warn) {
      shown.delete(warn);
    }
  }
}

/** Голод падает всегда; HP — только при голоде 0. */
function decayVitals(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  try {
    if (account.hospitalized) {
      return;
    }

    if (!player.isSpawned() || player.getState() === PLAYER_STATE_WASTED) {
      return;
    }

    const prevHunger = normalizeHunger(account.hunger);

    if (prevHunger > 0) {
      const nextHunger = Math.max(0, prevHunger - HUNGER_DECAY_AMOUNT);
      patchAccount(player, { hunger: nextHunger });
      warnHungerIfNeeded(player, prevHunger, nextHunger);
      queueSave(player);

      if (nextHunger > 0) {
        return;
      }
      // Достигли 0 в этом тике — HP ещё не трогаем, начнём со следующего.
      return;
    }

    const live = player.getHealth();
    if (live <= MIN_HEALTH) {
      return;
    }

    const next = Math.max(MIN_HEALTH, live - HEALTH_DECAY_AMOUNT);
    player.setHealth(next);
    trustHealth(player, next);
    patchAccount(player, { health: next });
    queueSave(player);
  } catch {
    // Игрок уже вышел.
  }
}

export const persistModule: GameModule = {
  name: "persist",
  start() {
    omp.on("playerTakeDamage", (player, from, amount) => {
      if (isSafeZoneDamage(player, from)) {
        return;
      }
      const account = getAccount(player);
      if (account) {
        try {
          const after = Math.min(
            MAX_HEALTH,
            Math.max(0, player.getHealth() - Number(amount))
          );
          if (after > 0) {
            patchAccount(player, { health: after });
          }
        } catch {
          // Слот уже невалиден.
        }
      }

      setTimeout(() => {
        rememberHealth(player);
      }, 50);
    });

    omp.on("playerDisconnect", (player) => {
      const slotId = playerId(player);
      if (slotId !== null) {
        hungerWarned.delete(slotId);
      }
      queueSave(player);
    });

    setInterval(() => {
      omp.players.forEach((player) => {
        if (isAuthenticated(player)) {
          queueSave(player);
        }
      });
    }, VITALS_SAVE_MS);

    setInterval(() => {
      omp.players.forEach(decayVitals);
    }, HEALTH_DECAY_MS);
  },
};
