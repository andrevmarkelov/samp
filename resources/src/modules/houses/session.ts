const insideHouse = new Map<number, number>();

export function setInsideHouse(slotId: number, houseId: number | null): void {
  if (houseId === null) {
    insideHouse.delete(slotId);
    return;
  }

  insideHouse.set(slotId, houseId);
}

export function getInsideHouse(slotId: number): number | null {
  return insideHouse.get(slotId) ?? null;
}

export function clearInsideHouse(slotId: number): void {
  insideHouse.delete(slotId);
}
