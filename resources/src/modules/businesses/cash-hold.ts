import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";

/** Пока покупка пишет наличные сама, периодический save не затирает их старым значением. */
const holds = new Set<number>();

export function holdBusinessCash(slotId: number): void {
  holds.add(slotId);
}

export function releaseBusinessCash(slotId: number): void {
  holds.delete(slotId);
}

export function isBusinessCashHeld(player: Player): boolean {
  const id = playerId(player);
  return id !== null && holds.has(id);
}
