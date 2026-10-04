import type { Gender } from "../auth/gender";
import type { SkinOption } from "../auth/skins";

export type ClothesSkinOption = SkinOption & { price: number };

/** Каталог магазина одежды по полу. */
export const CLOTHES_SKINS: Record<Gender, ClothesSkinOption[]> = {
  male: [
    { id: 1, label: "The Truth", price: 2_500 },
    { id: 2, label: "Maccer", price: 2_000 },
    { id: 3, label: "Andre", price: 2_200 },
    { id: 4, label: 'Barry "Big Bear" Thorne [Thin]', price: 3_000 },
    { id: 5, label: 'Barry "Big Bear" Thorne [Big]', price: 3_500 },
    { id: 6, label: "Emmet", price: 1_800 },
    { id: 7, label: "Taxi Driver/Train Driver", price: 1_500 },
  ],
  female: [
    { id: 9, label: "Normal Ped", price: 2_000 },
    { id: 10, label: "Old Woman", price: 1_500 },
    { id: 11, label: "Casino croupier", price: 4_000 },
    { id: 12, label: "Rich Woman", price: 5_000 },
    { id: 13, label: "Street Girl", price: 1_800 },
    { id: 31, label: "Farm-Town inhabitant", price: 2_200 },
    { id: 38, label: "Normal Ped", price: 2_000 },
  ],
};

export function clothesCatalog(gender: Gender): ClothesSkinOption[] {
  return CLOTHES_SKINS[gender];
}

export function asClothesSkin(skin: SkinOption | null): ClothesSkinOption | null {
  if (!skin || typeof (skin as ClothesSkinOption).price !== "number") {
    return null;
  }
  return skin as ClothesSkinOption;
}
