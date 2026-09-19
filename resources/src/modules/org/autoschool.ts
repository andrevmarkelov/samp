import { defineGovOrg, defineRanks, streetSpawn } from "./define";

export const ORG_AUTOSCHOOL_ID = 7;

export const AUTOSCHOOL = defineGovOrg(
  ORG_AUTOSCHOOL_ID,
  "Avtoshkola",
  0xfff3b0ff,
  streetSpawn(739.3572, -1415.0651, 13.5172, 357.9492),
  defineRanks([
    { title: "Stazher", male: 185, female: 11, pay: 1700 },
    { title: "Uchenik", male: 185, female: 11, pay: 2200 },
    { title: "Kursant", male: 185, female: 11, pay: 2800 },
    { title: "Instruktor-stazher", male: 59, female: 11, pay: 3500 },
    { title: "Instruktor", male: 59, female: 172, pay: 4300 },
    { title: "Starshiy instruktor", male: 240, female: 172, pay: 5200 },
    { title: "Ekzamenator", male: 240, female: 172, pay: 6300 },
    { title: "Starshiy ekzamenator", male: 171, female: 194, pay: 7600 },
    { title: "Zamestitel' direktora", male: 189, female: 194, pay: 9100 },
    { title: "Direktor avtoshkoly", male: 295, female: 150, pay: 11000 },
  ])
);
