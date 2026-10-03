import { MAX_FAMILY_RANK, MIN_FAMILY_RANK, type FamilyRankDef } from "./types";

const FAMILY_RANKS: readonly FamilyRankDef[] = [
  { id: 1, title: "Шпана" },
  { id: 2, title: "Браток" },
  { id: 3, title: "Свой" },
  { id: 4, title: "Бывалый" },
  { id: 5, title: "Авторитет" },
  { id: 6, title: "Смотрящий" },
  { id: 7, title: "Бригадир" },
  { id: 8, title: "Правая рука" },
  { id: 9, title: "Заместитель" },
  { id: 10, title: "Босс" },
];

export function getFamilyRank(rankId: number): FamilyRankDef | null {
  const id = Math.floor(rankId);
  if (id < MIN_FAMILY_RANK || id > MAX_FAMILY_RANK) {
    return null;
  }

  return FAMILY_RANKS[id - 1] ?? null;
}

export function allFamilyRanks(): readonly FamilyRankDef[] {
  return FAMILY_RANKS;
}
