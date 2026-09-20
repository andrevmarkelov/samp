import type { ExamKind } from "./session";

export type ExamQuestion = {
  text: string;
  answers: readonly string[];
  correct: number;
};

export const EXAM_RULES =
  "Kratkie pravila PDD:\n" +
  "1. Na krasnyy svet — polnaya ostanovka.\n" +
  "2. V gorode — ne vyshe 60 km/h.\n" +
  "3. Na ravnoznachnom perekrestke ustupayte pomeshe sprava.\n" +
  "4. Obgon cherez sploshnuyu liniyu zapreshchyon.\n" +
  "5. Remen' bezopasnosti / shlem obyazatel'ny.\n\n" +
  "Dalee test iz 5 voprosov. Nuzhno otvetit' na vse pravil'no.\n" +
  "Stoimost' testa: $500.";

const CAR_QUESTIONS: readonly ExamQuestion[] = [
  {
    text: "Chto delat' na krasnyy signal svetofora?",
    answers: ["Ostanovit'sya", "Proekhat' bystree", "Podat' signal i ehat'"],
    correct: 0,
  },
  {
    text: "Kakaya maksimal'naya skorost' v gorode?",
    answers: ["120 km/h", "60 km/h", "200 km/h"],
    correct: 1,
  },
  {
    text: "Komu ustupat' na ravnoznachnom perekrestke?",
    answers: ["Pomeshe sleva", "Nikomu", "Pomeshe sprava"],
    correct: 2,
  },
  {
    text: "Mozhno li obgonyat' cherez sploshnuyu liniyu?",
    answers: ["Net", "Da", "Tol'ko noch'yu"],
    correct: 0,
  },
  {
    text: "Nuzhen li remen' bezopasnosti?",
    answers: ["Net", "Tol'ko na trasse", "Da, obyazatelen"],
    correct: 2,
  },
];

const MOTO_QUESTIONS: readonly ExamQuestion[] = [
  {
    text: "Chto delat' na krasnyy signal svetofora?",
    answers: ["Ostanovit'sya", "Ob'ekhat' po obochine", "Proekhat', esli nikogo net"],
    correct: 0,
  },
  {
    text: "Nuzhen li shlem na motocikle?",
    answers: ["Net", "Da, obyazatelen", "Tol'ko za gorodom"],
    correct: 1,
  },
  {
    text: "Mozhno li ehat' mezhdu ryadami mashin?",
    answers: ["Da, vsegda", "Tol'ko na pustom shosse", "Net"],
    correct: 2,
  },
  {
    text: "Kakaya maksimal'naya skorost' v gorode?",
    answers: ["60 km/h", "140 km/h", "Bez ogranicheniy"],
    correct: 0,
  },
  {
    text: "Mozhno li obgonyat' cherez sploshnuyu liniyu?",
    answers: ["Da, na motocikle mozhno", "Net", "Tol'ko sprava"],
    correct: 1,
  },
];

export function examQuestions(kind: ExamKind): readonly ExamQuestion[] {
  return kind === "car" ? CAR_QUESTIONS : MOTO_QUESTIONS;
}
