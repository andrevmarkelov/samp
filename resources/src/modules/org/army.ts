import { STREET_WORLD } from "../spawn/point";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_ARMY_ID = 1;

const ARMY_COLOR = 0x9c7a4bff;

function armyRanks(): OrgRankDef[] {
  const rows: Array<{ title: string; male: number; female: number; pay: number }> = [
    { title: "Ryadovoy", male: 287, female: 191, pay: 1500 },
    { title: "Efreytor", male: 287, female: 191, pay: 1900 },
    { title: "Serzhant", male: 179, female: 191, pay: 2400 },
    { title: "Starshina", male: 179, female: 191, pay: 3000 },
    { title: "Leytenant", male: 255, female: 191, pay: 3700 },
    { title: "Kapitan", male: 255, female: 191, pay: 4500 },
    { title: "Mayor", male: 255, female: 191, pay: 5400 },
    { title: "Podpolkovnik", male: 61, female: 191, pay: 6400 },
    { title: "Polkovnik", male: 61, female: 191, pay: 7500 },
    { title: "General", male: 61, female: 191, pay: 9000 },
  ];

  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: row.pay,
    skins: { male: row.male, female: row.female },
  }));
}

export const ARMY: OrganizationDef = {
  id: ORG_ARMY_ID,
  name: "Armiya",
  color: ARMY_COLOR,
  spawn: {
    x: 2733.9255,
    y: -2449.3652,
    z: 17.5938,
    angle: 305.0398,
    interior: 0,
    world: STREET_WORLD,
  },
  ranks: armyRanks(),
};

if (ARMY.ranks.length !== MAX_ORG_RANK) {
  throw new Error("Armiya: nuzhno 10 rangov");
}

const ARMY_GATE = {
  orgId: ORG_ARMY_ID,
  model: 19912,
  rx: 0,
  ry: 0,
  rz: 90,
  radius: 14,
  denyMessage: "Vy ne sostoite v armii.",
} as const;

export const ARMY_GATES: OrgGateDef[] = [
  {
    ...ARMY_GATE,
    x: 2719.74878,
    y: -2399.5542,
    zClosed: 15.2148,
    zOpen: 9.6798,
  },
  {
    ...ARMY_GATE,
    x: 2719.74878,
    y: -2498.31299,
    zClosed: 15.2148,
    zOpen: 9.6798,
  },
];
