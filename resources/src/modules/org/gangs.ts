import { STREET_WORLD, type SpawnPoint } from "../spawn/point";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_GROVE_ID = 9;
export const ORG_BALLAS_ID = 10;
export const ORG_VAGOS_ID = 11;
export const ORG_RIFA_ID = 12;
export const ORG_AZTECAS_ID = 13;

const GANG_PAY = [800, 1100, 1500, 2000, 2600, 3300, 4100, 5000, 6000, 7200];

type GangRankRow = {
  title: string;
  male: number;
};

function streetSpawn(
  x: number,
  y: number,
  z: number,
  angle: number
): SpawnPoint {
  return { x, y, z, angle, interior: 0, world: STREET_WORLD };
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
    throw new Error(`${name}: nuzhno 10 rangov`);
  }

  return org;
}

export const GROVE = defineGang(
  ORG_GROVE_ID,
  "Grove Street",
  0x009900aa,
  streetSpawn(2512.2371, -1686.0691, 13.5614, 44.2188),
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
  streetSpawn(2028.5479, -1121.1851, 26.4164, 91.1957),
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
  streetSpawn(2755.4487, -1175.7596, 69.4076, 89.3391),
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
  streetSpawn(2781.7666, -1928.8019, 13.5469, 1.6284),
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
  streetSpawn(2180.5889, -1811.9956, 13.5469, 270.181),
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
