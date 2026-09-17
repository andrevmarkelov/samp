import type { Gender } from "./gender";

export type SkinOption = {
  id: number;
  label: string;
};

export const SKINS: Record<Gender, SkinOption[]> = {
  male: [
    { id: 78, label: "Bomzh" },
    { id: 79, label: "Bomzh 2" },
    { id: 134, label: "Bomzh 3" },
    { id: 136, label: "Obychnyy" },
    { id: 137, label: "Bomzh 4" },
    { id: 160, label: "Derevenshchina" },
    { id: 200, label: "Derevenshchina 2" },
    { id: 212, label: "Bomzh 5" },
    { id: 213, label: "Strannyy starik" },
    { id: 230, label: "Bomzh 6" },
    { id: 239, label: "Bomzh 7" },
  ],
  female: [
    { id: 77, label: "Bomzhikha" },
    { id: 90, label: "Begunka" },
    { id: 93, label: "Obychnaya" },
    { id: 131, label: "Fermersha" },
    { id: 151, label: "Obychnaya 2" },
    { id: 157, label: "Derevenshchina" },
    { id: 190, label: "Barbara" },
    { id: 192, label: "Michelle" },
    { id: 198, label: "Fermerskiy gorodok" },
    { id: 201, label: "Fermer" },
    { id: 211, label: "Prodavshchica" },
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
