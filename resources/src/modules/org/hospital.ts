import { HOSPITAL_WORLD } from "../spawn/point";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_HOSPITAL_ID = 2;

const HOSPITAL_COLOR = 0xff7a8aff;
const FEMALE_SKIN = 170;

function hospitalRanks(): OrgRankDef[] {
  const rows: Array<{ title: string; male: number; pay: number }> = [
    { title: "Intern", male: 274, pay: 1800 },
    { title: "Mladshiy med. rabotnik", male: 274, pay: 2300 },
    { title: "Starshiy med. rabotnik", male: 70, pay: 2900 },
    { title: "Vrach-uchastkovyy", male: 71, pay: 3600 },
    { title: "Terapevt", male: 71, pay: 4400 },
    { title: "Hirurg", male: 276, pay: 5400 },
    { title: "Zaveduyuschiy otdeleniem", male: 275, pay: 6500 },
    { title: "Starshiy ordinator", male: 275, pay: 7700 },
    { title: "Zamestitel' glavnogo vracha", male: 70, pay: 9000 },
    { title: "Glavnyy vrach", male: 70, pay: 10800 },
  ];

  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: row.pay,
    skins: { male: row.male, female: FEMALE_SKIN },
  }));
}

export const HOSPITAL: OrganizationDef = {
  id: ORG_HOSPITAL_ID,
  name: "Bol'nica",
  color: HOSPITAL_COLOR,
  gov: true,
  spawn: {
    x: 1585.8877,
    y: 1797.2903,
    z: -20.7924,
    angle: 356.7169,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  ranks: hospitalRanks(),
};

if (HOSPITAL.ranks.length !== MAX_ORG_RANK) {
  throw new Error("Bol'nica: nuzhno 10 rangov");
}

export const HOSPITAL_GATES: OrgGateDef[] = [
  {
    orgId: ORG_HOSPITAL_ID,
    model: 19912,
    x: 1148.72375,
    y: -1290.95996,
    zClosed: 15.3248,
    zOpen: 9.7632,
    rx: 0,
    ry: 0,
    rz: 0,
    radius: 14,
    denyMessage: "Vy ne sostoite v bol'nice.",
  },
];
