import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";
import { getAccount } from "../auth/session";

const loggedIn = new Set<number>();
const loginAttempts = new Map<number, number>();
const pendingPassword = new Map<number, string>();

export function isAdminLoggedIn(player: Player): boolean {
  const id = playerId(player);
  return id !== null && loggedIn.has(id);
}

export function hasAdminAccess(player: Player, minLevel: number): boolean {
  if (!isAdminLoggedIn(player)) {
    return false;
  }

  const account = getAccount(player);
  return !!account && account.adminLevel >= minLevel;
}

export function markAdminLoggedIn(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  loggedIn.add(id);
  pendingPassword.delete(id);

  const account = getAccount(player);
  if (account) {
    loginAttempts.delete(account.id);
  }
}

export function clearAdminSession(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  loggedIn.delete(id);
  pendingPassword.delete(id);
}

export function failAdminLogin(accountId: number): number {
  const next = (loginAttempts.get(accountId) ?? 0) + 1;
  loginAttempts.set(accountId, next);
  return next;
}

export function setPendingAdminPassword(player: Player, password: string): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  pendingPassword.set(id, password);
}

export function takePendingAdminPassword(player: Player): string | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  const value = pendingPassword.get(id) ?? null;
  pendingPassword.delete(id);
  return value;
}
