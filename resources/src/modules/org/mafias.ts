import type { SpawnPoint } from "../spawn/point";
import type { OrganizationDef, OrgGateDef, OrgRankDef } from "./types";
import { MAX_ORG_RANK } from "./types";

export const ORG_LCN_ID = 14;
export const ORG_YAKUZA_ID = 15;
export const ORG_RUSSIAN_MAFIA_ID = 16;

/** Madd Dogg's Mansion — общий интерьер семей, разные VW. */
export const MAFIA_INTERIOR = 5;
export const LCN_WORLD = 14;
export const YAKUZA_WORLD = 15;
export const RUSSIAN_MAFIA_WORLD = 16;

const MAFIA_PAY = [1000, 1400, 1900, 2500, 3200, 4000, 4900, 5900, 7000, 8500];

type MafiaRankRow = {
  title: string;
  male: number;
};

function mafiaRanks(female: number, rows: MafiaRankRow[]): OrgRankDef[] {
  return rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    pay: MAFIA_PAY[index] ?? 1000,
    skins: { male: row.male, female },
  }));
}

function mafiaHqSpawn(world: number): SpawnPoint {
  return {
    x: 1291.5886,
    y: -833.188,
    z: 1085.6328,
    angle: 89.5906,
    interior: MAFIA_INTERIOR,
    world,
  };
}

function defineMafia(
  id: number,
  name: string,
  color: number,
  spawn: SpawnPoint,
  female: number,
  rows: MafiaRankRow[]
): OrganizationDef {
  const org: OrganizationDef = {
    id,
    name,
    color,
    gov: false,
    illegal: false,
    mafia: true,
    spawn,
    ranks: mafiaRanks(female, rows),
  };

  if (org.ranks.length !== MAX_ORG_RANK) {
    throw new Error(`${name}: nuzhno 10 rangov`);
  }

  return org;
}

export const LCN = defineMafia(
  ORG_LCN_ID,
  "La Cosa Nostra",
  0xff8000ff,
  mafiaHqSpawn(LCN_WORLD),
  263,
  [
    { title: "Novizio", male: 119 },
    { title: "Associato", male: 119 },
    { title: "Picciotto", male: 43 },
    { title: "Uomo d'Onore", male: 290 },
    { title: "Soldato", male: 127 },
    { title: "Capodecina", male: 127 },
    { title: "Capo", male: 113 },
    { title: "Consigliere", male: 113 },
    { title: "Sottocapo", male: 223 },
    { title: "Don", male: 223 },
  ]
);

export const YAKUZA = defineMafia(
  ORG_YAKUZA_ID,
  "Yakuza",
  0xcc0000ff,
  mafiaHqSpawn(YAKUZA_WORLD),
  56,
  [
    { title: "Vakasyu", male: 121 },
    { title: "Syatey", male: 122 },
    { title: "Kobun", male: 123 },
    { title: "Syameygasira", male: 117 },
    { title: "Vakagasira", male: 118 },
    { title: "So-honbute", male: 124 },
    { title: "Sayko-Komon", male: 208 },
    { title: "Kambu", male: 120 },
    { title: "Oyadzi", male: 186 },
    { title: "Kumityo", male: 294 },
  ]
);

export const RUSSIAN_MAFIA = defineMafia(
  ORG_RUSSIAN_MAFIA_ID,
  "Russkaya mafiya",
  0x1a5c6eff,
  mafiaHqSpawn(RUSSIAN_MAFIA_WORLD),
  169,
  [
    { title: "Shnyr'", male: 112 },
    { title: "Bosyak", male: 112 },
    { title: "Bratok", male: 272 },
    { title: "Byk", male: 272 },
    { title: "Avtoritet", male: 126 },
    { title: "Zam. brigadira", male: 125 },
    { title: "Brigadir", male: 111 },
    { title: "Smotryaschiy", male: 98 },
    { title: "Blatnoy", male: 46 },
    { title: "Vor v zakone", male: 46 },
  ]
);

export const MAFIAS: readonly OrganizationDef[] = [LCN, YAKUZA, RUSSIAN_MAFIA];

export const LCN_GATES: OrgGateDef[] = [
  {
    orgId: ORG_LCN_ID,
    model: 19912,
    x: 1282.35217,
    y: -2050.71509,
    zClosed: 60.6006,
    zOpen: 55.0073,
    rx: 0,
    ry: 0,
    rz: 90,
    radius: 14,
    denyMessage: "Vy ne sostoite v La Cosa Nostra.",
  },
];

const YAKUZA_GATE = {
  orgId: ORG_YAKUZA_ID,
  model: 19912,
  rx: 0,
  ry: 0,
  radius: 14,
  denyMessage: "Vy ne sostoite v Yakuza.",
} as const;

export const YAKUZA_GATES: OrgGateDef[] = [
  {
    ...YAKUZA_GATE,
    x: 670.69287,
    y: -1309.53784,
    zClosed: 15.2336,
    zOpen: 9.6836,
    rz: 0,
  },
  {
    ...YAKUZA_GATE,
    x: 661.96692,
    y: -1221.85962,
    zClosed: 17.9462,
    zOpen: 12.2892,
    rz: 61.51915,
  },
  {
    ...YAKUZA_GATE,
    x: 786.05829,
    y: -1158.20215,
    zClosed: 25.3149,
    zOpen: 19.8112,
    rz: -90,
  },
];

export const RUSSIAN_MAFIA_GATES: OrgGateDef[] = [
  {
    orgId: ORG_RUSSIAN_MAFIA_ID,
    model: 968,
    x: 965.55011,
    y: -942.06873,
    zClosed: 40.1682,
    zOpen: 40.1682,
    rx: 0,
    ry: -90,
    ryOpen: 0,
    rz: 0.7162,
    radius: 14,
    denyMessage: "Vy ne sostoite v Russkoy mafii.",
  },
];
