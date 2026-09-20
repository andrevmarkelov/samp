import type { SpawnPoint } from "../spawn/point";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_GROVE_ID = 9;
export const ORG_BALLAS_ID = 10;
export const ORG_VAGOS_ID = 11;
export const ORG_RIFA_ID = 12;
export const ORG_AZTECAS_ID = 13;

/** Дома банд — ванильные интерьеры, у каждой свой VW (= org id). */
export const GROVE_WORLD = 9;
export const BALLAS_WORLD = 10;
export const VAGOS_WORLD = 11;
export const RIFA_WORLD = 12;
export const AZTECAS_WORLD = 13;

const GANG_PAY = [800, 1100, 1500, 2000, 2600, 3300, 4100, 5000, 6000, 7200];

type GangRankRow = {
  title: string;
  male: number;
};

function hqSpawn(
  x: number,
  y: number,
  z: number,
  angle: number,
  interior: number,
  world: number
): SpawnPoint {
  return { x, y, z, angle, interior, world };
}

function gangRanks(female: number, rows: GangRankRow[]): OrgRankDef[] {
  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: GANG_PAY[index] ?? 800,
    skins: { male: row.male, female },
  }));
}

function defineGang(
  id: number,
  name: string,
  color: number,
  spawn: SpawnPoint,
  female: number,
  rows: GangRankRow[]
): OrganizationDef {
  const org: OrganizationDef = {
    id,
    name,
    color,
    gov: false,
    illegal: true,
    spawn,
    ranks: gangRanks(female, rows),
  };

  if (org.ranks.length !== MAX_ORG_RANK) {
    throw new Error(`${name}: нужно 10 рангов`);
  }

  return org;
}

export const GROVE = defineGang(
  ORG_GROVE_ID,
  "Grove Street",
  0x009900aa,
  hqSpawn(2449.4707, -1690.2758, 1013.5078, 179.8317, 2, GROVE_WORLD),
  195,
  [
    { title: "Newman", male: 105 },
    { title: "Hustla", male: 105 },
    { title: "True", male: 106 },
    { title: "Gangsta", male: 106 },
    { title: "Warrior", male: 106 },
    { title: "Shooter", male: 107 },
    { title: "O.G", male: 107 },
    { title: "Big O.G", male: 269 },
    { title: "Legend", male: 271 },
    { title: "Daddy", male: 207 },
  ]
);

export const BALLAS = defineGang(
  ORG_BALLAS_ID,
  "The Ballas",
  0xcc00ffaa,
  hqSpawn(224.9616, 1158.2284, 1082.6094, 89.0343, 4, BALLAS_WORLD),
  195,
  [
    { title: "Baby", male: 103 },
    { title: "Tested", male: 103 },
    { title: "Youngin", male: 103 },
    { title: "Hustler", male: 102 },
    { title: "Gangsta", male: 102 },
    { title: "Shooter", male: 102 },
    { title: "Enforcer", male: 104 },
    { title: "Shot Caller", male: 10 },
    { title: "Star", male: 104 },
    { title: "Big Daddy", male: 104 },
  ]
);

export const VAGOS = defineGang(
  ORG_VAGOS_ID,
  "Los Santos Vagos",
  0xffcd00aa,
  hqSpawn(323.8303, 1127.1255, 1083.8828, 178.9385, 5, VAGOS_WORLD),
  190,
  [
    { title: "Novato", male: 108 },
    { title: "Compinche", male: 108 },
    { title: "Bandito", male: 108 },
    { title: "Vato Loco", male: 108 },
    { title: "Chaval", male: 110 },
    { title: "Forajido", male: 110 },
    { title: "Veterano", male: 110 },
    { title: "Soldado", male: 109 },
    { title: "El Orgullo", male: 109 },
    { title: "Padre", male: 109 },
  ]
);

export const RIFA = defineGang(
  ORG_RIFA_ID,
  "The Rifa",
  0x6666ffaa,
  hqSpawn(-60.6872, 1364.6147, 1080.2185, 90.2645, 6, RIFA_WORLD),
  226,
  [
    { title: "Amigo", male: 175 },
    { title: "Macho", male: 175 },
    { title: "Junior", male: 175 },
    { title: "Soldado", male: 174 },
    { title: "Bandido", male: 174 },
    { title: "Capitan", male: 174 },
    { title: "Teniente", male: 173 },
    { title: "Veterano", male: 173 },
    { title: "Jefe", male: 173 },
    { title: "Padre", male: 273 },
  ]
);

export const AZTECAS = defineGang(
  ORG_AZTECAS_ID,
  "Varios Los Aztecas",
  0x00b4e1aa,
  hqSpawn(231.2349, 1246.6328, 1082.1406, 136.928, 2, AZTECAS_WORLD),
  193,
  [
    { title: "Novato", male: 114 },
    { title: "Amigo", male: 114 },
    { title: "Soldado", male: 114 },
    { title: "Bandido", male: 116 },
    { title: "Vato", male: 116 },
    { title: "Capitan", male: 116 },
    { title: "Teniente", male: 115 },
    { title: "Veterano", male: 115 },
    { title: "Jefe", male: 115 },
    { title: "Padre", male: 292 },
  ]
);

export const GANGS: readonly OrganizationDef[] = [GROVE, BALLAS, VAGOS, RIFA, AZTECAS];
