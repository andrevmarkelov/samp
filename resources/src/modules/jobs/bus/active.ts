import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";

/** Слоты игроков на активной смене водителя автобуса. */
const activeSlots = new Set<number>();

export function isBusDriverOnShift(player: Player): boolean {
  const id = playerId(player);
  return id !== null && activeSlots.has(id);
}

export function setBusDriverShiftActive(slot: number, active: boolean): void {
  if (active) {
    activeSlots.add(slot);
  } else {
    activeSlots.delete(slot);
  }
}
