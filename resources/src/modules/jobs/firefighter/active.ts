import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";

/** Слоты игроков на смене пожарного. */
const activeSlots = new Set<number>();

export function isFirefighterOnShift(player: Player): boolean {
  const id = playerId(player);
  return id !== null && activeSlots.has(id);
}

export function setFirefighterShiftActive(slot: number, active: boolean): void {
  if (active) {
    activeSlots.add(slot);
  } else {
    activeSlots.delete(slot);
  }
}

export function firefighterShiftSlots(): readonly number[] {
  return [...activeSlots];
}
