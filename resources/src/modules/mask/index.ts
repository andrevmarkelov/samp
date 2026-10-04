import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";

/** Тёмно-серый ник; alpha 0 — скрытие с радара (SA-MP). */
export const MASK_COLOR = 0x2a2a2a00;
export const MASK_DURATION_MS = 10 * 60 * 1000;
export const MASK_DURATION_MINUTES = 10;
const ANIM_SYNC_ALL = 1;
const ANIM_DELAY_MS = 100;

type MaskState = {
  /** Уникальный id надевания — защита от чужого expire/анимации. */
  token: number;
  timer: ReturnType<typeof setTimeout>;
};

/** Купленные маски — только на сессию (слот), без БД. */
const owned = new Map<number, number>();
const wearing = new Map<number, MaskState>();
let nextWearToken = 1;

/** Восстановление скина/цвета (биндится из org, без циклического импорта). */
let restoreVisuals: ((player: Player) => void) | null = null;

export function bindMaskVisualRestore(fn: (player: Player) => void): void {
  restoreVisuals = fn;
}

export function getOwnedMasks(player: Player): number {
  const id = playerId(player);
  if (id === null) {
    return 0;
  }

  return owned.get(id) ?? 0;
}

/** +N масок в сессионный инвентарь. */
export function addOwnedMasks(player: Player, amount = 1): number {
  const id = playerId(player);
  if (id === null) {
    return 0;
  }

  const add = Math.max(0, Math.floor(amount));
  const next = (owned.get(id) ?? 0) + add;
  owned.set(id, next);
  return next;
}

export function isMasked(player: Player): boolean {
  const id = playerId(player);
  return id !== null && wearing.has(id);
}

export function applyMaskVisuals(player: Player): void {
  try {
    player.setColor(MASK_COLOR);
  } catch {
    // Слот ещё не в игре.
  }
}

/** Снять маску (флаг + таймер). Визуал — через restoreVisuals / applyOrgVisuals. */
export function clearMask(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  const state = wearing.get(id);
  if (!state) {
    return false;
  }

  clearTimeout(state.timer);
  wearing.delete(id);
  return true;
}

/**
 * Надеть маску: списывает 1 шт. из сессии, 10 минут, скрытие с радара.
 * false — нельзя (нет маски / уже надета / тюрьма и т.п.).
 */
export function wearMask(player: Player): boolean {
  const id = playerId(player);
  const account = getAccount(player);
  if (id === null || !account || wearing.has(id)) {
    return false;
  }

  const have = owned.get(id) ?? 0;
  if (account.hospitalized || account.jailSeconds > 0 || have < 1) {
    return false;
  }

  owned.set(id, have - 1);

  const token = nextWearToken++;
  const timer = setTimeout(() => {
    expireMask(player, id, token);
  }, MASK_DURATION_MS);

  wearing.set(id, { token, timer });
  restoreVisuals?.(player);
  playMaskAnim(player, true, token);
  return true;
}

/** Снять маску вручную (/mask повторно). Без анимации при смерти/тюрьме/таймере. */
export function removeMask(player: Player): boolean {
  const id = playerId(player);
  const token = id !== null ? wearing.get(id)?.token : undefined;
  if (!clearMask(player)) {
    return false;
  }

  restoreVisuals?.(player);
  if (token !== undefined) {
    playMaskAnim(player, false, token);
  }
  return true;
}

function preloadMaskAnim(player: Player): void {
  try {
    player.applyAnimation(
      "SHOP",
      "ROB_Shifty",
      4.1,
      false,
      false,
      false,
      false,
      1,
      ANIM_SYNC_ALL
    );
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Подтянется при /mask.
  }
}

function playMaskAnim(
  player: Player,
  expectMasked: boolean,
  token: number
): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  // setSkin в restoreVisuals сбрасывает аним в том же тике — чуть отложить.
  setTimeout(() => {
    if (playerId(player) !== slotId || !isPlayerActive(player)) {
      return;
    }

    if (expectMasked) {
      if (wearing.get(slotId)?.token !== token) {
        return;
      }
    } else if (wearing.has(slotId)) {
      // Уже снова надел другую маску — анимацию снятия не играем.
      return;
    }

    try {
      player.applyAnimation(
        "SHOP",
        "ROB_Shifty",
        4.1,
        false,
        false,
        false,
        false,
        0,
        ANIM_SYNC_ALL
      );
    } catch {
      // Анимация опциональна.
    }
  }, ANIM_DELAY_MS);
}

function clearSession(slotId: number): void {
  const state = wearing.get(slotId);
  if (state) {
    clearTimeout(state.timer);
    wearing.delete(slotId);
  }
  owned.delete(slotId);
}

function expireMask(player: Player, slotId: number, token: number): void {
  const state = wearing.get(slotId);
  if (!state || state.token !== token) {
    return;
  }

  wearing.delete(slotId);

  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  if (playerId(player) !== slotId) {
    return;
  }

  restoreVisuals?.(player);
  try {
    player.sendClientMessage(Color.gray, "Маска снята: время вышло.");
  } catch {
    // Слот пуст.
  }
}

export const maskModule: GameModule = {
  name: "mask",
  start() {
    omp.on("playerSpawn", (player) => {
      if (isAuthenticated(player)) {
        preloadMaskAnim(player);
      }
    });

    omp.on("playerDeath", (player) => {
      if (!clearMask(player)) {
        return;
      }

      // Смерть — только снять эффект, без анимации.
      restoreVisuals?.(player);
      if (isPlayerActive(player)) {
        player.sendClientMessage(Color.gray, "Маска снята.");
      }
    });

    omp.on("playerConnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearSession(id);
      }
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearSession(id);
      }
    });
  },
};
