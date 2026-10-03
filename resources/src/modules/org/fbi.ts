import { defineGovOrg, defineRanks } from "./define";

export const ORG_FBI_ID = 6;
/** Кастомный интерьер FBI (`maps/fbi.txt`): interior 0, VW = org id. */
export const FBI_WORLD = ORG_FBI_ID;
export const FBI_INTERIOR = 0;

export const FBI = defineGovOrg(
  ORG_FBI_ID,
  "FBI",
  0x000080ff,
  {
    x: 668.7235,
    y: 2560.2925,
    z: -89.4551,
    angle: 177.9197,
    interior: FBI_INTERIOR,
    world: FBI_WORLD,
  },
  defineRanks([
    { title: "Стажёр", male: 286, female: 306, pay: 2200 },
    { title: "Мл. агент", male: 286, female: 306, pay: 2800 },
    { title: "Агент отдела ГНК", male: 164, female: 306, pay: 3500 },
    { title: "Агент отдела КСО", male: 163, female: 306, pay: 4300 },
    { title: "Старший агент", male: 303, female: 306, pay: 5200 },
    { title: "Глава отдела ГНК", male: 304, female: 306, pay: 6200 },
    { title: "Глава отдела КСО", male: 305, female: 306, pay: 7400 },
    { title: "Инспектор FBI", male: 166, female: 306, pay: 8800 },
    { title: "Зам. директора FBI", male: 165, female: 306, pay: 10500 },
    { title: "Директор FBI", male: 295, female: 76, pay: 13000 },
  ])
);
