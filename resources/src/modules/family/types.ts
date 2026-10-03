export const FAMILY_NONE = 0;
export const MIN_FAMILY_RANK = 1;
export const MAX_FAMILY_RANK = 10;
export const FAMILY_STAFF_MIN_RANK = 9;
export const FAMILY_MANAGE_MAX_RANK = 9;

/** Стоимость регистрации семьи в мэрии ($). */
export const FAMILY_CREATE_COST = 250_000;
/** Минимальный уровень персонажа для создания. */
export const FAMILY_CREATE_MIN_LEVEL = 5;

export const FAMILY_NAME_MIN = 2;
export const FAMILY_NAME_MAX = 24;
export const FAMILY_DESC_MAX = 128;

export type FamilyRankDef = {
  id: number;
  title: string;
};

export type FamilyRecord = {
  id: number;
  name: string;
  description: string;
  level: number;
  exp: number;
  ownerId: number;
  ammo: number;
  metal: number;
  drugs: number;
  money: number;
  isLocked: boolean;
  createdAt: string;
};

export function parseFamilyId(value: unknown): number {
  const id = Math.floor(Number(value));
  if (!Number.isFinite(id) || id < 0) {
    return FAMILY_NONE;
  }

  return id;
}

export function parseFamilyRank(value: unknown): number {
  const rank = Math.floor(Number(value));
  if (!Number.isFinite(rank) || rank < MIN_FAMILY_RANK) {
    return 0;
  }

  return Math.min(MAX_FAMILY_RANK, rank);
}
