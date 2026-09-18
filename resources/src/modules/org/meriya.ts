import { STREET_WORLD } from "../spawn/point";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_MERIYA_ID = 3;

const MERIYA_COLOR = 0xffff00ff;
export const CITY_HALL_INTERIOR = 3;

function meriyaRanks(): OrgRankDef[] {
  const rows: Array<{ title: string; male: number; female: number; pay: number }> = [
    { title: "Ohrannik", male: 164, female: 141, pay: 2500 },
    { title: "Sekretar'", male: 185, female: 141, pay: 3300 },
    { title: "Starshiy sekretar'", male: 59, female: 141, pay: 4200 },
    { title: "Nachal'nik ohrany", male: 165, female: 141, pay: 5300 },
    { title: "Advokat", male: 57, female: 141, pay: 6600 },
    { title: "Pomoschnik deputata", male: 98, female: 76, pay: 8100 },
    { title: "Sovetnik", male: 227, female: 76, pay: 9800 },
    { title: "Deputat", male: 187, female: 76, pay: 11800 },
    { title: "Zam. Mera", male: 17, female: 76, pay: 14200 },
    { title: "Mer", male: 147, female: 150, pay: 17000 },
  ];

  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: row.pay,
    skins: { male: row.male, female: row.female },
  }));
}

export const MERIYA: OrganizationDef = {
  id: ORG_MERIYA_ID,
  name: "Meriya",
  color: MERIYA_COLOR,
  gov: true,
  illegal: false,
  spawn: {
    x: 357.3111,
    y: 162.1018,
    z: 1025.7964,
    angle: 270.2384,
    interior: CITY_HALL_INTERIOR,
    world: STREET_WORLD,
  },
  ranks: meriyaRanks(),
};

if (MERIYA.ranks.length !== MAX_ORG_RANK) {
  throw new Error("Meriya: nuzhno 10 rangov");
}
