import { STREET_WORLD } from "../spawn/point";
import { defineGovOrg, defineRanks } from "./define";

export const ORG_AUTOSCHOOL_ID = 7;
export const AUTOSCHOOL_INTERIOR = 3;

export const AUTOSCHOOL = defineGovOrg(
  ORG_AUTOSCHOOL_ID,
  "Автошкола",
  0xfff3b0ff,
  {
    x: -2024.3811,
    y: -114.5691,
    z: 1035.1719,
    angle: 87.7811,
    interior: AUTOSCHOOL_INTERIOR,
    world: STREET_WORLD,
  },
  defineRanks([
    { title: "Стажёр", male: 185, female: 11, pay: 1700 },
    { title: "Ученик", male: 185, female: 11, pay: 2200 },
    { title: "Курсант", male: 185, female: 11, pay: 2800 },
    { title: "Инструктор-стажёр", male: 59, female: 11, pay: 3500 },
    { title: "Инструктор", male: 59, female: 172, pay: 4300 },
    { title: "Старший инструктор", male: 240, female: 172, pay: 5200 },
    { title: "Экзаменатор", male: 240, female: 172, pay: 6300 },
    { title: "Старший экзаменатор", male: 171, female: 194, pay: 7600 },
    { title: "Заместитель директора", male: 189, female: 194, pay: 9100 },
    { title: "Директор автошколы", male: 295, female: 150, pay: 11000 },
  ])
);
