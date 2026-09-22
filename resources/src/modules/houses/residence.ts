import { findOwnedHouse } from "./repository";

export function residenceLabel(userId: number): string {
  const house = findOwnedHouse(userId);
  if (!house) {
    return "Бездомный";
  }

  return `Дом (№${house.id})`;
}
