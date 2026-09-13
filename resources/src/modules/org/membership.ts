import type { Account } from "../auth/session";
import type { SpawnPoint } from "../spawn/point";
import { getOrgRank, getOrganization } from "./catalog";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK, MIN_ORG_RANK, ORG_NONE } from "./types";

export type OrgMembership = {
  org: OrganizationDef;
  rank: OrgRankDef;
};

export function parseOrgId(value: unknown): number {
  const id = Math.floor(Number(value) || 0);
  return id > 0 ? id : ORG_NONE;
}

export function parseOrgRank(value: unknown): number {
  const rank = Math.floor(Number(value) || 0);
  if (rank < MIN_ORG_RANK || rank > MAX_ORG_RANK) {
    return 0;
  }
  return rank;
}

export function getMembership(
  account: Pick<Account, "orgId" | "orgRank">
): OrgMembership | null {
  const org = getOrganization(account.orgId);
  if (!org) {
    return null;
  }

  const rank = getOrgRank(org, account.orgRank);
  if (!rank) {
    return null;
  }

  return { org, rank };
}

export function resolveOrgSpawn(
  account: Pick<Account, "orgId" | "orgRank"> | null | undefined
): SpawnPoint | null {
  if (!account) {
    return null;
  }

  return getMembership(account)?.org.spawn ?? null;
}

export function orgPaydayPay(
  account: Pick<Account, "orgId" | "orgRank">
): { amount: number; orgName: string; rankTitle: string } | null {
  const membership = getMembership(account);
  if (!membership) {
    return null;
  }

  const amount = Math.max(0, Math.floor(membership.rank.pay));
  if (amount <= 0) {
    return null;
  }

  return {
    amount,
    orgName: membership.org.name,
    rankTitle: membership.rank.title,
  };
}

export function orgStatsLines(
  account: Pick<Account, "orgId" | "orgRank">
): string[] {
  const membership = getMembership(account);
  if (!membership) {
    return ["Organizaciya: Net"];
  }

  return [
    `Organizaciya: ${membership.org.name}`,
    `Dolzhnost': ${membership.rank.title} (${membership.rank.id})`,
  ];
}
