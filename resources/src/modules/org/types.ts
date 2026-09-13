import type { SpawnPoint } from "../spawn/point";

export const ORG_NONE = 0;
export const MIN_ORG_RANK = 1;
export const MAX_ORG_RANK = 10;

export type OrgSkins = {
  male: number;
  female: number;
};

export type OrgRankDef = {
  id: number;
  title: string;
  pay: number;
  skins: OrgSkins;
};

export type OrganizationDef = {
  id: number;
  name: string;
  color: number;
  spawn: SpawnPoint;
  ranks: readonly OrgRankDef[];
};

export type OrgGateDef = {
  orgId: number;
  model: number;
  x: number;
  y: number;
  zClosed: number;
  zOpen: number;
  rx: number;
  ry: number;
  rz: number;
  radius: number;
  denyMessage: string;
};
