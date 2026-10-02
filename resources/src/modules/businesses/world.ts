/** VW бизнесов: 2000 + id (не пересекается с органами 1–16 и домами 1000+). */
export const BUSINESS_WORLD_OFFSET = 2000;

export function businessVirtualWorld(businessId: number): number {
  return BUSINESS_WORLD_OFFSET + businessId;
}

export function isBusinessVirtualWorld(world: number): boolean {
  return world >= BUSINESS_WORLD_OFFSET;
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
