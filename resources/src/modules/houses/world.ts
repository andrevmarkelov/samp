/** Смещение VW домов: 1000–1999 (не пересекается с бизнесами 2000+ и семьями 100000+). */
export const HOUSE_WORLD_OFFSET = 1000;
/** Верхняя граница VW домов (начало диапазона бизнесов). */
const HOUSE_WORLD_END = 2000;

export function houseVirtualWorld(houseId: number): number {
  return HOUSE_WORLD_OFFSET + houseId;
}

export function isHouseVirtualWorld(world: number): boolean {
  return world >= HOUSE_WORLD_OFFSET && world < HOUSE_WORLD_END;
}

export function houseIdFromVirtualWorld(world: number): number | null {
  if (!isHouseVirtualWorld(world)) {
    return null;
  }

  const houseId = world - HOUSE_WORLD_OFFSET;
  if (!Number.isInteger(houseId) || houseId < 1) {
    return null;
  }

  return houseId;
}
