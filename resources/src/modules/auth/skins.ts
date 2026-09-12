import type { Gender } from "./gender";

export type SkinOption = {
  id: number;
  label: string;
};

export const SKINS: Record<Gender, SkinOption[]> = {
  male: [
    { id: 26, label: "Гражданский" },
    { id: 17, label: "Деловой" },
    { id: 23, label: "Байкер" },
    { id: 28, label: "Район" },
    { id: 46, label: "Богатый" },
    { id: 60, label: "Костюм" },
    { id: 72, label: "Хиппи" },
    { id: 170, label: "Азиат" },
    { id: 188, label: "Продавец" },
    { id: 240, label: "Офис" },
    { id: 290, label: "Плейбой" },
    { id: 292, label: "Панк" },
    { id: 294, label: "Кожанка" },
    { id: 297, label: "Стрит" },
    { id: 299, label: "Клубный" },
  ],
  female: [
    { id: 12, label: "Богатая" },
    { id: 13, label: "Район" },
    { id: 40, label: "Деловая" },
    { id: 41, label: "Модная" },
    { id: 55, label: "Средних лет" },
    { id: 69, label: "В очках" },
    { id: 91, label: "Клуб" },
    { id: 93, label: "Стрит" },
    { id: 141, label: "Девушка" },
    { id: 150, label: "Бизнес" },
    { id: 191, label: "Модель" },
    { id: 193, label: "Блондинка" },
    { id: 211, label: "Офис" },
    { id: 233, label: "Короткая стрижка" },
    { id: 251, label: "Клубная" },
  ],
};

export function skinListBody(gender: Gender): string {
  return SKINS[gender].map((skin) => `${skin.label} (${skin.id})`).join("\n");
}

export function skinByIndex(gender: Gender, index: number): SkinOption | null {
  return SKINS[gender][index] ?? null;
}
