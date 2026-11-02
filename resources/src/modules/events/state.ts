import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";

const participants = new Set<number>();

const disconnectHooks: Array<(player: Player) => void> = [];

export function setEventParticipant(player: Player, active: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }
  if (active) {
    participants.add(id);
    return;
  }
  participants.delete(id);
}

export function isEventParticipant(player: Player): boolean {
  const id = playerId(player);
  return id !== null && participants.has(id);
}

export function clearEventParticipant(player: Player): void {
  setEventParticipant(player, false);
}

/** Вызывается из сохранения персонажа до записи денег, чтобы вернуть взнос. */
export function setEventDisconnectHook(hook: ((player: Player) => void) | null): void {
  if (!hook) {
    disconnectHooks.length = 0;
    return;
  }
  if (!disconnectHooks.includes(hook)) {
    disconnectHooks.push(hook);
  }
}

export function runEventDisconnectHook(player: Player): void {
  for (const hook of disconnectHooks) {
    hook(player);
  }
}
