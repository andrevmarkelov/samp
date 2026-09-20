import { defineGovOrg, defineRanks } from "./define";
import type { OrgGateDef } from "./types";

export const ORG_RADIO_ID = 8;
/** Кастомный интерьер Radiocentr. Улица и крыша остаются VW 0. */
export const RADIO_WORLD = 8;
export const RADIO_INTERIOR = 0;

export const RADIOCENTR = defineGovOrg(
  ORG_RADIO_ID,
  "Radiocentr",
  0xff8c00ff,
  {
    x: 1429.5406,
    y: 1071.8772,
    z: 1058.7916,
    angle: 154.0138,
    interior: RADIO_INTERIOR,
    world: RADIO_WORLD,
  },
  defineRanks([
    { title: "Pomoschnik redakcii", male: 250, female: 93, pay: 1700 },
    { title: "Verstal'schik novostey", male: 250, female: 93, pay: 2200 },
    { title: "Radiotehnik", male: 60, female: 93, pay: 2800 },
    { title: "Zhurnalist", male: 60, female: 93, pay: 3500 },
    { title: "Starshiy zhurnalist", male: 170, female: 211, pay: 4300 },
    { title: "Korrektor", male: 188, female: 211, pay: 5200 },
    { title: "Pomoschnik redaktora", male: 188, female: 211, pay: 6300 },
    { title: "Redaktor", male: 187, female: 211, pay: 7600 },
    { title: "Glavnyy redaktor", male: 227, female: 211, pay: 9100 },
    { title: "Direktor radiocentra", male: 228, female: 150, pay: 11000 },
  ])
);

export const RADIO_GATES: OrgGateDef[] = [
  {
    orgId: ORG_RADIO_ID,
    model: 968,
    x: 1739.44507,
    y: -1309.9248,
    zClosed: 13.4962,
    zOpen: 13.4962,
    rx: 0,
    ry: 90,
    ryOpen: 0,
    rz: 11.4037,
    radius: 14,
    denyMessage: "Vy ne sostoite v radiocentre.",
  },
];
