import { defineGovOrg, defineRanks, streetSpawn } from "./define";

export const ORG_FBI_ID = 6;

export const FBI = defineGovOrg(
  ORG_FBI_ID,
  "FBI",
  0x000080ff,
  streetSpawn(609.8445, -1475.0566, 14.6137, 359.8291),
  defineRanks([
    { title: "Stazher", male: 286, female: 306, pay: 2200 },
    { title: "Ml. agent", male: 286, female: 306, pay: 2800 },
    { title: "Agent otdela GNK", male: 164, female: 306, pay: 3500 },
    { title: "Agent otdela KSO", male: 163, female: 306, pay: 4300 },
    { title: "Starshiy agent", male: 303, female: 306, pay: 5200 },
    { title: "Glava otdela GNK", male: 304, female: 306, pay: 6200 },
    { title: "Glava otdela KSO", male: 305, female: 306, pay: 7400 },
    { title: "Inspektor FBI", male: 166, female: 306, pay: 8800 },
    { title: "Zam. direktora FBI", male: 165, female: 306, pay: 10500 },
    { title: "Direktor FBI", male: 295, female: 76, pay: 13000 },
  ])
);
