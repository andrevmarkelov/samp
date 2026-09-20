import { STREET_WORLD, type SpawnPoint } from "../spawn/point";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export type RankRow = {
  title: string;
  male: number;
  female: number;
  pay: number;
};

export function defineRanks(rows: readonly RankRow[]): OrgRankDef[] {
  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: row.pay,
    skins: { male: row.male, female: row.female },
  }));
}

export function streetSpawn(x: number, y: number, z: number, angle: number): SpawnPoint {
  return { x, y, z, angle, interior: 0, world: STREET_WORLD };
}

export function defineGovOrg(
  id: number,
  name: string,
  color: number,
  spawn: SpawnPoint,
  ranks: readonly OrgRankDef[]
): OrganizationDef {
  const org: OrganizationDef = {
    id,
    name,
    color,
    gov: true,
    illegal: false,
    spawn,
    ranks,
  };

  if (org.ranks.length !== MAX_ORG_RANK) {
    throw new Error(`${name}: нужно 10 рангов`);
  }

  return org;
}
