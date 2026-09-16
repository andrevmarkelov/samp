import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import { saveUserVitals } from "../auth/repository";
import {
  HEALTH_DECAY_AMOUNT,
  HEALTH_DECAY_MS,
  MAX_HEALTH,
  MIN_HEALTH,
  VITALS_SAVE_MS,
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { isSafeZoneDamage } from "../zones/safe";
import type { GameModule } from "../types";

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

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

export function queueSave(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const health = readLiveHealth(player, account.health);
  const money = Math.max(0, Math.floor(account.money));
  patchAccount(player, { health, money });

  if (isInWorld(player)) {
    applyWallet(player, { ...account, money });
  }

  void saveUserVitals(account.id, health, money).catch((error: unknown) => {
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

function decayHealth(player: Player): void {
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

    const live = player.getHealth();
    if (live <= MIN_HEALTH) {
      return;
    }

    const next = Math.max(MIN_HEALTH, live - HEALTH_DECAY_AMOUNT);
    player.setHealth(next);
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
      omp.players.forEach(decayHealth);
    }, HEALTH_DECAY_MS);
  },
};
