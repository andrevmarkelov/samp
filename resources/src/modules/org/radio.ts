import { defineGovOrg, defineRanks, streetSpawn } from "./define";

export const ORG_RADIO_ID = 8;

export const RADIOCENTR = defineGovOrg(
  ORG_RADIO_ID,
  "Radiocentr",
  0xff8c00ff,
  streetSpawn(1806.5552, -1287.9512, 13.6314, 92.8667),
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
