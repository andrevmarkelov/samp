/**
 * Смещение VW семейных домов.
 * Диапазоны: улица 0, органы 1–16, дома 1000–1999, бизнесы 2000–99999, семьи 100000+.
 */
export const FAMILY_WORLD_OFFSET = 100_000;

export function familyVirtualWorld(familyId: number): number {
  return FAMILY_WORLD_OFFSET + familyId;
}

export function isFamilyVirtualWorld(world: number): boolean {
  return world >= FAMILY_WORLD_OFFSET;
}

export function familyIdFromVirtualWorld(world: number): number | null {
  if (!isFamilyVirtualWorld(world)) {
    return null;
  }

  const familyId = world - FAMILY_WORLD_OFFSET;
  if (!Number.isInteger(familyId) || familyId < 1) {
    return null;
  }

  return familyId;
}
