import { ARMY, ARMY_GATES } from "./army";
import { GANGS } from "./gangs";
import { HOSPITAL, HOSPITAL_GATES } from "./hospital";
import { MERIYA } from "./meriya";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";

const ORGANIZATIONS: readonly OrganizationDef[] = [ARMY, HOSPITAL, MERIYA, ...GANGS];
const ORG_GATES: readonly OrgGateDef[] = [...ARMY_GATES, ...HOSPITAL_GATES];

const byId = new Map(ORGANIZATIONS.map((org) => [org.id, org]));

export function getOrganization(id: number): OrganizationDef | null {
  return byId.get(id) ?? null;
}

export function getOrgRank(org: OrganizationDef, rank: number): OrgRankDef | null {
  return org.ranks.find((item) => item.id === rank) ?? null;
}

export function allOrganizations(): readonly OrganizationDef[] {
  return ORGANIZATIONS;
}

export function allOrgGates(): readonly OrgGateDef[] {
  return ORG_GATES;
}
