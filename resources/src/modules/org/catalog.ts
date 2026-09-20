import { ARMY, ARMY_GATES } from "./army";
import { AUTOSCHOOL } from "./autoschool";
import { FBI } from "./fbi";
import { GANGS } from "./gangs";
import { HOSPITAL, HOSPITAL_GATES } from "./hospital";
import { MAFIAS, YAKUZA_GATES } from "./mafias";
import { MERIYA } from "./meriya";
import { LSPD, LSPD_GATES } from "./lspd";
import { POLICE } from "./police";
import { RADIOCENTR } from "./radio";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";

const ORGANIZATIONS: readonly OrganizationDef[] = [
  ARMY,
  HOSPITAL,
  MERIYA,
  POLICE,
  LSPD,
  FBI,
  AUTOSCHOOL,
  RADIOCENTR,
  ...GANGS,
  ...MAFIAS,
];
const ORG_GATES: readonly OrgGateDef[] = [
  ...ARMY_GATES,
  ...HOSPITAL_GATES,
  ...LSPD_GATES,
  ...YAKUZA_GATES,
];

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
