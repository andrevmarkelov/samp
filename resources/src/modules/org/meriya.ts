import { STREET_WORLD } from "../spawn/point";
import type { OrganizationDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_MERIYA_ID = 3;

const MERIYA_COLOR = 0xffff00ff;
export const CITY_HALL_INTERIOR = 3;

function meriyaRanks(): OrgRankDef[] {
  const rows: Array<{ title: string; male: number; female: number; pay: number }> = [
    { title: "Охранник", male: 164, female: 141, pay: 2500 },
    { title: "Секретарь", male: 185, female: 141, pay: 3300 },
    { title: "Старший секретарь", male: 59, female: 141, pay: 4200 },
    { title: "Начальник охраны", male: 165, female: 141, pay: 5300 },
    { title: "Адвокат", male: 57, female: 141, pay: 6600 },
    { title: "Помощник депутата", male: 98, female: 76, pay: 8100 },
    { title: "Советник", male: 227, female: 76, pay: 9800 },
    { title: "Депутат", male: 187, female: 76, pay: 11800 },
    { title: "Зам. Мэра", male: 17, female: 76, pay: 14200 },
    { title: "Мэр", male: 147, female: 150, pay: 17000 },
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
  name: "Мэрия",
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
  throw new Error("Мэрия: нужно 10 рангов");
}
