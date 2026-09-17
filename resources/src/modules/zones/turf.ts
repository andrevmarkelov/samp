import { GangZone, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import { isPlayerActive } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { GANGS, getOrganization } from "../org";
import { STREET_WORLD } from "../spawn/point";
import {
  ensureGangZonesTable,
  loadGangZones,
  saveGangZoneOwner,
} from "./repository";

const EMPTY_COLOR = 0x808080aa;

/** Id зон респа из старого дампа — их нельзя каптить. */
const LEGACY_SPAWN_ZONE_IDS: ReadonlySet<number> = new Set([7, 25, 67, 74, 90]);

export type LiveTurf = {
  id: number;
  orgId: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  spawnProtected: boolean;
  zone: GangZone;
};

let turfs: LiveTurf[] = [];

export function turfColor(orgId: number): number {
  return getOrganization(orgId)?.color ?? EMPTY_COLOR;
}

export function isGangOrgId(orgId: number): boolean {
  return GANGS.some((gang) => gang.id === orgId);
}

export function listTurfs(): readonly LiveTurf[] {
  return turfs;
}

export function getTurf(zoneId: number): LiveTurf | undefined {
  return turfs.find((item) => item.id === zoneId);
}

export function isPointInTurf(turf: LiveTurf, x: number, y: number): boolean {
  const minX = Math.min(turf.minX, turf.maxX);
  const maxX = Math.max(turf.minX, turf.maxX);
  const minY = Math.min(turf.minY, turf.maxY);
  const maxY = Math.max(turf.minY, turf.maxY);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function playerOnTurf(player: Player, turf: LiveTurf): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return isPointInTurf(turf, pos.x, pos.y);
  } catch {
    return false;
  }
}

export function findTurfAtPlayer(player: Player): LiveTurf | null {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return null;
    }

    const pos = player.getPos();
    let best: LiveTurf | null = null;
    let bestArea = Number.POSITIVE_INFINITY;

    for (const turf of turfs) {
      if (!isPointInTurf(turf, pos.x, pos.y)) {
        continue;
      }

      const area =
        Math.abs(turf.maxX - turf.minX) * Math.abs(turf.maxY - turf.minY);
      if (area < bestArea) {
        best = turf;
        bestArea = area;
      }
    }

    return best;
  } catch {
    return null;
  }
}

export async function startGangTurf(): Promise<void> {
  if (!isDatabaseReady()) {
    omp.log(`[${SERVER_TAG}] гангзоны: нет БД`);
    return;
  }

  try {
    await ensureGangZonesTable();
    const records = await loadGangZones();
    const created: LiveTurf[] = [];

    for (const record of records) {
      try {
        const zone = new GangZone(record.minX, record.minY, record.maxX, record.maxY);
        const color = turfColor(record.orgId);
        zone.showForAll(color);
        created.push({
          id: record.id,
          orgId: record.orgId,
          minX: record.minX,
          minY: record.minY,
          maxX: record.maxX,
          maxY: record.maxY,
          spawnProtected: false,
          zone,
        });
      } catch {
        // Пул зон заполнен.
      }
    }

    turfs = markSpawnProtected(created);
    omp.log(`[${SERVER_TAG}] гангзоны: ${turfs.length}/${records.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] gang_zones: ${message}`);
  }
}

export function showGangTurf(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  for (const turf of turfs) {
    try {
      turf.zone.showForPlayer(player, turfColor(turf.orgId));
    } catch {
      // Игрок уже вышел.
    }
  }
}

export async function setGangZoneOwner(zoneId: number, orgId: number): Promise<boolean> {
  if (!isGangOrgId(orgId)) {
    return false;
  }

  const turf = getTurf(zoneId);
  if (!turf) {
    return false;
  }

  if (isDatabaseReady()) {
    try {
      await saveGangZoneOwner(zoneId, orgId);
    } catch {
      return false;
    }
  } else {
    return false;
  }

  turf.orgId = orgId;
  try {
    turf.zone.stopFlashForAll();
    turf.zone.showForAll(turfColor(orgId));
  } catch {
    // Зона уже уничтожена.
  }
  return true;
}

function markSpawnProtected(items: LiveTurf[]): LiveTurf[] {
  const spawnIds = new Set(LEGACY_SPAWN_ZONE_IDS);

  for (const gang of GANGS) {
    let best: LiveTurf | null = null;
    let bestArea = Number.POSITIVE_INFINITY;

    for (const turf of items) {
      if (!isPointInTurf(turf, gang.spawn.x, gang.spawn.y)) {
        continue;
      }

      const area =
        Math.abs(turf.maxX - turf.minX) * Math.abs(turf.maxY - turf.minY);
      if (area < bestArea) {
        best = turf;
        bestArea = area;
      }
    }

    if (best) {
      spawnIds.add(best.id);
    }
  }

  return items.map((turf) =>
    spawnIds.has(turf.id) ? { ...turf, spawnProtected: true } : turf
  );
}
