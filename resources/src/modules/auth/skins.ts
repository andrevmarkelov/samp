import type { Gender } from "./gender";

export type SkinOption = {
  id: number;
  label: string;
};

export const SKINS: Record<Gender, SkinOption[]> = {
  male: [
    { id: 26, label: "Grazhdanskiy" },
    { id: 17, label: "Delovoy" },
    { id: 23, label: "Bayker" },
    { id: 28, label: "Rayon" },
    { id: 46, label: "Bogatyy" },
    { id: 60, label: "Kostyum" },
    { id: 72, label: "Khippi" },
    { id: 170, label: "Aziat" },
    { id: 188, label: "Prodavec" },
    { id: 240, label: "Ofis" },
    { id: 290, label: "Pleyboy" },
    { id: 292, label: "Pank" },
    { id: 294, label: "Kozhanka" },
    { id: 297, label: "Strit" },
    { id: 299, label: "Klubnyy" },
  ],
  female: [
    { id: 12, label: "Bogataya" },
    { id: 13, label: "Rayon" },
    { id: 40, label: "Delovaya" },
    { id: 41, label: "Modnaya" },
    { id: 55, label: "Srednikh let" },
    { id: 69, label: "V ochkakh" },
    { id: 91, label: "Klub" },
    { id: 93, label: "Strit" },
    { id: 141, label: "Devushka" },
    { id: 150, label: "Biznes" },
    { id: 191, label: "Model'" },
    { id: 193, label: "Blondinka" },
    { id: 211, label: "Ofis" },
    { id: 233, label: "Korotkaya strizhka" },
    { id: 251, label: "Klubnaya" },
  ],
};

export function skinListBody(gender: Gender): string {
  return SKINS[gender].map((skin) => `${skin.label} (${skin.id})`).join("\n");
}

export function skinByIndex(gender: Gender, index: number): SkinOption | null {
  return SKINS[gender][index] ?? null;
}
