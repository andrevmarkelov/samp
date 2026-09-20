import { HOSPITAL_WORLD } from "../spawn/point";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_HOSPITAL_ID = 2;

const HOSPITAL_COLOR = 0xff7a8aff;
const FEMALE_SKIN = 170;

function hospitalRanks(): OrgRankDef[] {
  const rows: Array<{ title: string; male: number; pay: number }> = [
    { title: "Интерн", male: 274, pay: 1800 },
    { title: "Младший мед. работник", male: 274, pay: 2300 },
    { title: "Старший мед. работник", male: 70, pay: 2900 },
    { title: "Врач-участковый", male: 71, pay: 3600 },
    { title: "Терапевт", male: 71, pay: 4400 },
    { title: "Хирург", male: 276, pay: 5400 },
    { title: "Заведующий отделением", male: 275, pay: 6500 },
    { title: "Старший ординатор", male: 275, pay: 7700 },
    { title: "Заместитель главного врача", male: 70, pay: 9000 },
    { title: "Главный врач", male: 70, pay: 10800 },
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
  name: "Больница",
  color: HOSPITAL_COLOR,
  gov: true,
  illegal: false,
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
  throw new Error("Больница: нужно 10 рангов");
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
    denyMessage: "Вы не состоите в больнице.",
  },
];
