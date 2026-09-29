import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";

/** Меню уже показали на этом заходе на маркер. */
const stockVisitByPlayer = new Set<number>();
/** Сейчас открыт диалог склада — нельзя перебивать. */
const stockDialogBusy = new Set<number>();

export function isOrgStockDialogBusy(player: Player): boolean {
  const id = playerId(player);
  return id !== null && stockDialogBusy.has(id);
}

export function setOrgStockDialogBusy(player: Player, busy: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (busy) {
    stockDialogBusy.add(id);
  } else {
    stockDialogBusy.delete(id);
  }
}

/** @returns false — уже показывали меню на этом заходе. */
export function markOrgStockVisit(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  if (stockVisitByPlayer.has(id)) {
    return false;
  }

  stockVisitByPlayer.add(id);
  return true;
}

/** Вышел с маркера — можно снова открыть при следующем входе. */
export function clearOrgStockVisit(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    stockVisitByPlayer.delete(id);
  }
}

export function clearOrgStockVisitById(id: number): void {
  stockVisitByPlayer.delete(id);
  stockDialogBusy.delete(id);
}
