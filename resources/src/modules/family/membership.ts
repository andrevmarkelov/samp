import type { Account } from "../auth/session";
import { getFamily } from "./catalog";
import { getFamilyRank } from "./ranks";
import {
  FAMILY_NONE,
  FAMILY_STAFF_MIN_RANK,
  type FamilyRankDef,
  type FamilyRecord,
} from "./types";

export type FamilyMembership = {
  family: FamilyRecord;
  rank: FamilyRankDef;
};

export { parseFamilyId, parseFamilyRank } from "./types";

export function getFamilyMembership(account: Account): FamilyMembership | null {
  if (account.familyId === FAMILY_NONE) {
    return null;
  }

  const family = getFamily(account.familyId);
  const rank = getFamilyRank(account.familyRank);
  if (!family || !rank) {
    return null;
  }

  return { family, rank };
}

export function isFamilyStaff(account: Account): boolean {
  const membership = getFamilyMembership(account);
  return !!membership && membership.rank.id >= FAMILY_STAFF_MIN_RANK;
}

export function isFamilyOwner(account: Account): boolean {
  const membership = getFamilyMembership(account);
  return !!membership && membership.family.ownerId === account.id;
}
