const insideBusiness = new Map<number, number>();

export function setInsideBusiness(slotId: number, businessId: number | null): void {
  if (businessId === null) {
    insideBusiness.delete(slotId);
    return;
  }

  insideBusiness.set(slotId, businessId);
}

export function getInsideBusiness(slotId: number): number | null {
  return insideBusiness.get(slotId) ?? null;
}

export function clearInsideBusiness(slotId: number): void {
  insideBusiness.delete(slotId);
}
