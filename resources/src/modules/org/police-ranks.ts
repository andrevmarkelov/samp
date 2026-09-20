import { defineRanks } from "./define";

export const POLICE_COLOR = 0x2641feff;

export const POLICE_RANKS = defineRanks([
  { title: "Рядовой", male: 266, female: 307, pay: 2000 },
  { title: "Сержант", male: 284, female: 307, pay: 2500 },
  { title: "Старший сержант", male: 267, female: 307, pay: 3100 },
  { title: "Лейтенант", male: 280, female: 307, pay: 3800 },
  { title: "Ст. Лейтенант", male: 281, female: 306, pay: 4600 },
  { title: "Капитан", male: 282, female: 306, pay: 5500 },
  { title: "Майор", male: 311, female: 306, pay: 6500 },
  { title: "Подполковник", male: 310, female: 306, pay: 7700 },
  { title: "Полковник", male: 283, female: 306, pay: 9000 },
  { title: "Генерал", male: 288, female: 76, pay: 11000 },
]);
