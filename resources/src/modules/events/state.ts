import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";

const participants = new Set<number>();

let disconnectHook: ((player: Player) => void) | null = null;

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
  disconnectHook = hook;
}

export function runEventDisconnectHook(player: Player): void {
  disconnectHook?.(player);
}
