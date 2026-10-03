/** VW бизнесов: 2000–99999 (не пересекается с домами 1000–1999 и семьями 100000+). */
export const BUSINESS_WORLD_OFFSET = 2000;
/** Верхняя граница VW бизнесов (начало диапазона семей). */
const BUSINESS_WORLD_END = 100_000;

export function businessVirtualWorld(businessId: number): number {
  return BUSINESS_WORLD_OFFSET + businessId;
}

export function isBusinessVirtualWorld(world: number): boolean {
  return world >= BUSINESS_WORLD_OFFSET && world < BUSINESS_WORLD_END;
}

export function businessIdFromVirtualWorld(world: number): number | null {
  if (!isBusinessVirtualWorld(world)) {
    return null;
  }

  const businessId = world - BUSINESS_WORLD_OFFSET;
  if (!Number.isInteger(businessId) || businessId < 1) {
    return null;
  }

  return businessId;
}
