import { defineRanks } from "./define";

export const POLICE_COLOR = 0x2641feff;

export const POLICE_RANKS = defineRanks([
  { title: "Ryadovoy", male: 266, female: 307, pay: 2000 },
  { title: "Serzhant", male: 284, female: 307, pay: 2500 },
  { title: "Starshiy serzhant", male: 267, female: 307, pay: 3100 },
  { title: "Leytenant", male: 280, female: 307, pay: 3800 },
  { title: "St. Leytenant", male: 281, female: 306, pay: 4600 },
  { title: "Kapitan", male: 282, female: 306, pay: 5500 },
  { title: "Mayor", male: 311, female: 306, pay: 6500 },
  { title: "Podpolkovnik", male: 310, female: 306, pay: 7700 },
  { title: "Polkovnik", male: 283, female: 306, pay: 9000 },
  { title: "General", male: 288, female: 76, pay: 11000 },
]);
