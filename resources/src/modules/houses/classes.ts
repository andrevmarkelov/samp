const HOUSE_CLASS_LABELS: Readonly<Record<number, string>> = {
  0: "Эконом",
  1: "Средний",
  2: "Стандарт",
  3: "Комфорт",
  4: "Премиум",
  5: "Элитный",
};

export function houseClassLabel(classId: number): string {
  return HOUSE_CLASS_LABELS[classId] ?? `Класс ${classId}`;
}
