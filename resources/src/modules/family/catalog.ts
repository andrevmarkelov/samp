import type { FamilyRecord } from "./types";

const cache = new Map<number, FamilyRecord>();

export function getFamily(familyId: number): FamilyRecord | null {
  return cache.get(familyId) ?? null;
}

export function listFamilies(): readonly FamilyRecord[] {
  return [...cache.values()];
}

export function setFamilyInCache(record: FamilyRecord): void {
  cache.set(record.id, record);
}

export function removeFamilyFromCache(familyId: number): void {
  cache.delete(familyId);
}

export function clearFamiliesCache(): void {
  cache.clear();
}

export function findFamilyInCacheByName(name: string): FamilyRecord | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const family of cache.values()) {
    if (family.name.toLowerCase() === normalized) {
      return family;
    }
  }

  return null;
}
