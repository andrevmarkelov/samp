import type { Gender } from "./gender";

export type SkinOption = {
  id: number;
  label: string;
};

export const SKINS: Record<Gender, SkinOption[]> = {
  male: [
    { id: 78, label: "Бомж" },
    { id: 79, label: "Бомж 2" },
    { id: 134, label: "Бомж 3" },
    { id: 136, label: "Обычный" },
    { id: 137, label: "Бомж 4" },
    { id: 160, label: "Деревенщина" },
    { id: 200, label: "Деревенщина 2" },
    { id: 212, label: "Бомж 5" },
    { id: 213, label: "Странный старик" },
    { id: 230, label: "Бомж 6" },
    { id: 239, label: "Бомж 7" },
  ],
  female: [
    { id: 77, label: "Бомжиха" },
    { id: 90, label: "Бегунка" },
    { id: 93, label: "Обычная" },
    { id: 131, label: "Фермерша" },
    { id: 151, label: "Обычная 2" },
    { id: 157, label: "Деревенщина" },
    { id: 190, label: "Barbara" },
    { id: 192, label: "Michelle" },
    { id: 198, label: "Фермерский городок" },
    { id: 201, label: "Фермер" },
    { id: 211, label: "Продавщица" },
  ],
};

export function skinListBody(gender: Gender): string {
  return SKINS[gender].map((skin) => `${skin.label} (${skin.id})`).join("\n");
}

export function skinByIndex(gender: Gender, index: number): SkinOption | null {
  return SKINS[gender][index] ?? null;
}

export function hasSkin(gender: Gender, skinId: number): boolean {
  return SKINS[gender].some((skin) => skin.id === skinId);
}

export function wrapSkinIndex(gender: Gender, index: number): number {
  const total = SKINS[gender].length;
  if (total <= 0) {
    return 0;
  }
  return ((index % total) + total) % total;
}

export function skinIndexOf(gender: Gender, skinId: number): number {
  const index = SKINS[gender].findIndex((skin) => skin.id === skinId);
  return index >= 0 ? index : 0;
}
