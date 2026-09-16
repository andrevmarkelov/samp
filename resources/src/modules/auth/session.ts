import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";
import type { Gender } from "./gender";

export const MAX_HEALTH = 100;
export const MIN_HEALTH = 20;
export const HOSPITAL_HEALTH = MIN_HEALTH;
export const STARTING_HEALTH = 100;
export const HEALTH_DECAY_AMOUNT = 1;
export const HEALTH_DECAY_MS = 15 * 60 * 1000;
export const VITALS_SAVE_MS = 3 * 60 * 1000;

export function normalizeHealth(value: unknown): number {
  const health = Number(value);
  if (!Number.isFinite(health) || health <= 0) {
    return STARTING_HEALTH;
  }

  return Math.min(MAX_HEALTH, health);
}

export type Account = {
  id: number;
  name: string;
  email: string;
  gender: Gender;
  skin: number;
  level: number;
  exp: number;
  money: number;
  bank: number;
  donate: number;
  health: number;
  passport: boolean;
  hospitalized: boolean;
  invitedBy: string | null;
  birthDate: string;
  adminLevel: number;
  orgId: number;
  orgRank: number;
};

const accounts = new Map<number, Account>();

export function isAuthenticated(player: Player): boolean {
  const id = playerId(player);
  return id !== null && accounts.has(id);
}

export function getAccount(player: Player): Account | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  return accounts.get(id) ?? null;
}

export function getGender(player: Player): Gender | null {
  return getAccount(player)?.gender ?? null;
}

export function setAccount(player: Player, account: Account): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  accounts.set(id, account);
}

export function clearAccount(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  accounts.delete(id);
}

export function applyWallet(player: Player, account: Account): void {
  try {
    player.resetMoney();
    if (account.money !== 0) {
      player.giveMoney(account.money);
    }
  } catch {
    // Слот ещё не в игре.
  }
}

export function applyHealth(player: Player, health: number): void {
  try {
    player.setHealth(health);
  } catch {
    // Слот ещё не в игре.
  }
}

export function applyScore(player: Player, level: number): void {
  try {
    player.setScore(Math.max(0, Math.floor(level)));
  } catch {
    // Слот ещё не в игре.
  }
}

export function patchAccount(
  player: Player,
  patch: Partial<
    Pick<
      Account,
      | "health"
      | "money"
      | "bank"
      | "passport"
      | "hospitalized"
      | "invitedBy"
      | "level"
      | "exp"
      | "adminLevel"
      | "orgId"
      | "orgRank"
    >
  >
): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  setAccount(player, { ...account, ...patch });
}
