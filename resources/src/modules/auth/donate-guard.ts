import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";

/** Покупка или обмен ещё не закончились — второй /donate не стартует. */
const operations = new Set<number>();

/**
 * Обмен доната на наличные пишет `money` сам.
 * Пока флаг стоит, периодическое сохранение не затирает наличные старым значением.
 */
const walletHolds = new Set<number>();

export function isDonateBusy(player: Player): boolean {
  const id = playerId(player);
  return id !== null && operations.has(id);
}

export function isDonateWalletHeld(player: Player): boolean {
  const id = playerId(player);
  return id !== null && walletHolds.has(id);
}

/** Слот, если блокировку взяли. null — слот неизвестен или покупка уже идёт. */
export function lockDonate(player: Player): number | null {
  const id = playerId(player);
  if (id === null || operations.has(id)) {
    return null;
  }

  operations.add(id);
  return id;
}

export function unlockDonate(slotId: number): void {
  operations.delete(slotId);
  walletHolds.delete(slotId);
}

export function holdDonateWallet(slotId: number): void {
  walletHolds.add(slotId);
}

export function releaseDonateWallet(slotId: number): void {
  walletHolds.delete(slotId);
}
