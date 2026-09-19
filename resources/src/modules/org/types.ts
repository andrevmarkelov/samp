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
  gov: boolean;
  illegal: boolean;
  spawn: SpawnPoint;
  ranks: readonly OrgRankDef[];
};

export type OrgGateDef = {
  orgId: number;
  /** Если задано — открыть может любой из этих органов. Иначе только `orgId`. */
  orgIds?: readonly number[];
  model: number;
  x: number;
  y: number;
  zClosed: number;
  zOpen: number;
  rx: number;
  ry: number;
  rz: number;
  /** Шлагбаум: закрыт `ry`, открыт `ryOpen` (тот же XYZ). */
  ryOpen?: number;
  radius: number;
  denyMessage: string;
};
