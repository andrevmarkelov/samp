import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";
import { trustHealth, trustMoney } from "../anticheat/trust";
import type { Gender } from "./gender";
import type { Licenses } from "./licenses";

export const MAX_HEALTH = 100;
export const MIN_HEALTH = 20;
export const MAX_LAWFULNESS = 100;
export const MIN_LAWFULNESS = -100;
export const STARTING_LAWFULNESS = 100;
export const HOSPITAL_HEALTH = MIN_HEALTH;
export const STARTING_HEALTH = 100;
export const MAX_HUNGER = 100;
export const STARTING_HUNGER = 100;
/** Длина номера телефона (6 цифр). null — телефона нет. */
export const PHONE_DIGITS = 6;
export const HEALTH_DECAY_AMOUNT = 1;
/** Тик голода / HP при голоде 0 (как раньше для HP). */
export const HEALTH_DECAY_MS = 15 * 60 * 1000;
/** Списание голода за тик (100 → 0 примерно за 5 ч). */
export const HUNGER_DECAY_AMOUNT = 5;
/** Пороги предупреждений о голоде (сверху вниз). */
export const HUNGER_WARN_LEVELS = [40, 30, 20] as const;
export const VITALS_SAVE_MS = 3 * 60 * 1000;

export function normalizeHealth(value: unknown): number {
  const health = Number(value);
  if (!Number.isFinite(health) || health <= 0) {
    return STARTING_HEALTH;
  }

  return Math.min(MAX_HEALTH, health);
}

export function normalizeHunger(value: unknown): number {
  const hunger = Math.floor(Number(value));
  if (!Number.isFinite(hunger)) {
    return STARTING_HUNGER;
  }

  return Math.min(MAX_HUNGER, Math.max(0, hunger));
}

/** Нормализованный номер (6 цифр) или null, если телефона нет / невалиден. */
export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }
  if (!new RegExp(`^\\d{${PHONE_DIGITS}}$`).test(raw)) {
    return null;
  }
  return raw;
}

export function normalizeLawfulness(value: unknown): number {
  const lawfulness = Math.floor(Number(value));
  if (!Number.isFinite(lawfulness)) {
    return STARTING_LAWFULNESS;
  }

  return Math.min(MAX_LAWFULNESS, Math.max(MIN_LAWFULNESS, lawfulness));
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
  lawfulness: number;
  health: number;
  drugs: number;
  ammo: number;
  metal: number;
  passport: boolean;
  hospitalized: boolean;
  /** Розыск 0–6 (звёзды SA). */
  wantedLevel: number;
  /** Военный билет. */
  militaryId: boolean;
  /** Медицинская карта. */
  medcard: boolean;
  /** Голод 0–100 (100 — сыт). */
  hunger: number;
  /** Номер телефона (6 цифр) или null, если телефона нет. */
  phone: string | null;
  invitedBy: string | null;
  birthDate: string;
  adminLevel: number;
  orgId: number;
  orgRank: number;
  familyId: number;
  familyRank: number;
  mutedUntil: number | null;
  jailSeconds: number;
  licenses: Licenses;
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
  trustMoney(player, account.money);
}

export function applyHealth(player: Player, health: number): void {
  try {
    player.setHealth(health);
  } catch {
    // Слот ещё не в игре.
  }
  trustHealth(player, health);
}

export function applyScore(player: Player, level: number): void {
  try {
    player.setScore(Math.max(0, Math.floor(level)));
  } catch {
    // Слот ещё не в игре.
  }
}

/** Звёзды розыска GTA SA (0–6). */
export function applyWantedLevel(player: Player, level: number): void {
  const wanted = normalizeWantedLevel(level);
  try {
    player.setWantedLevel(wanted);
  } catch {
    // Слот ещё не в игре.
  }
}

export function normalizeWantedLevel(value: unknown): number {
  const level = Math.floor(Number(value));
  if (!Number.isFinite(level) || level <= 0) {
    return 0;
  }

  return Math.min(6, level);
}

export function patchAccount(
  player: Player,
  patch: Partial<
    Pick<
      Account,
      | "health"
      | "money"
      | "bank"
      | "lawfulness"
      | "passport"
      | "hospitalized"
      | "wantedLevel"
      | "militaryId"
      | "medcard"
      | "hunger"
      | "phone"
      | "invitedBy"
      | "level"
      | "exp"
      | "adminLevel"
      | "orgId"
      | "orgRank"
      | "familyId"
      | "familyRank"
      | "skin"
      | "mutedUntil"
      | "jailSeconds"
      | "licenses"
      | "drugs"
      | "ammo"
      | "metal"
    >
  >
): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  setAccount(player, { ...account, ...patch });
}
