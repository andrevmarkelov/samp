import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import type { Account } from "../auth/session";
import { getAccount } from "../auth/session";
import { ARMY } from "./army";
import {
  ORG_AZTECAS_ID,
  ORG_BALLAS_ID,
  ORG_GROVE_ID,
  ORG_RIFA_ID,
  ORG_VAGOS_ID,
} from "./gangs";
import { getMembership } from "./membership";

const DISGUISE_SKIN_MALE = 287;
const DISGUISE_SKIN_FEMALE = 191;

const GHETTO_GANG_IDS: ReadonlySet<number> = new Set([
  ORG_GROVE_ID,
  ORG_BALLAS_ID,
  ORG_VAGOS_ID,
  ORG_RIFA_ID,
  ORG_AZTECAS_ID,
]);

/** Слоты игроков в армейской маскировке (банды у Смоки). */
const disguised = new Set<number>();

export function isArmyDisguised(player: Player): boolean {
  const id = playerId(player);
  return id !== null && disguised.has(id);
}

/** Форма действует только у члена банды гетто вне тюрьмы. */
export function canKeepArmyDisguise(player: Player): boolean {
  const account = getAccount(player);
  if (!account || account.jailSeconds > 0) {
    return false;
  }

  const membership = getMembership(account);
  return membership !== null && GHETTO_GANG_IDS.has(membership.org.id);
}

export function armyDisguiseSkin(account: Account): number {
  return account.gender === "female" ? DISGUISE_SKIN_FEMALE : DISGUISE_SKIN_MALE;
}

export function applyArmyDisguiseVisuals(player: Player, account: Account): void {
  try {
    player.setSkin(armyDisguiseSkin(account));
    player.setColor(ARMY.color);
  } catch {
    // Слот ещё не в игре.
  }
}

/** Включить маскировку (скин + цвет армии). Банда не меняется. */
export function startArmyDisguise(player: Player): boolean {
  const id = playerId(player);
  const account = getAccount(player);
  if (id === null || !account || !canKeepArmyDisguise(player)) {
    return false;
  }

  disguised.add(id);
  applyArmyDisguiseVisuals(player, account);
  return true;
}

/** Снять маскировку. Визуал восстанавливает вызывающая сторона через applyOrgVisuals. */
export function clearArmyDisguise(player: Player): boolean {
  const id = playerId(player);
  if (id === null || !disguised.has(id)) {
    return false;
  }

  disguised.delete(id);
  return true;
}

/**
 * Если маскировка больше невалидна (тюрьма / кик из банды) — снять флаг.
 * Возвращает true, если игрок сейчас должен выглядеть как армия.
 */
export function syncArmyDisguise(player: Player): boolean {
  if (!isArmyDisguised(player)) {
    return false;
  }

  if (canKeepArmyDisguise(player)) {
    return true;
  }

  clearArmyDisguise(player);
  return false;
}

export function bindArmyDisguise(): void {
  omp.on("playerDeath", (player) => {
    if (!clearArmyDisguise(player)) {
      return;
    }

    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.gray, "Армейская форма снята.");
    }
  });

  omp.on("playerConnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      disguised.delete(id);
    }
  });

  omp.on("playerDisconnect", (player) => {
    clearArmyDisguise(player);
  });
}
