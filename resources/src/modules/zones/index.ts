import { GangZone, omp, type Player } from "@omp-node/core";
import { isPlayerActive } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";

/** Чёрный, альфа FF — без прозрачности. */
const ZONE_COLOR = 0x000000ff;

type ClosedZone = {
  name: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const CLOSED_ZONES: readonly ClosedZone[] = [
  { name: "Zone 1", minX: -2999, minY: 604, maxX: 3000, maxY: 3005 },
  { name: "Zone 2", minX: -2999, minY: -3000.01, maxX: -997, maxY: 604 },
  { name: "Zone 3", minX: -1001, minY: -3000, maxX: 72, maxY: -1374 },
  { name: "Zone 4", minX: -1001, minY: -1379, maxX: -271, maxY: -340 },
  { name: "Zone 5", minX: -273.01, minY: -1379.49, maxX: 71.99, maxY: -918.49 },
  { name: "Zone 6", minX: -273, minY: -921.3, maxX: -156, maxY: -765.3 },
  { name: "Zone 7", minX: -192.73, minY: -922.3, maxX: -110.73, maxY: -862.3 },
  { name: "Zone 8", minX: -998, minY: 456, maxX: 695, maxY: 605 },
  { name: "Zone 9", minX: 1548, minY: 504, maxX: 3000, maxY: 604 },
];

let zones: GangZone[] = [];

export const zonesModule: GameModule = {
  name: "zones",
  start() {
    zones = CLOSED_ZONES.map(
      (zone) => new GangZone(zone.minX, zone.minY, zone.maxX, zone.maxY)
    );

    omp.on("playerSpawn", (player) => {
      if (!isAuthenticated(player)) {
        return;
      }

      showClosedZones(player);
    });
  },
};

function showClosedZones(player: Player): void {
  if (!isPlayerActive(player)) {
    return;
  }

  for (const zone of zones) {
    try {
      zone.showForPlayer(player, ZONE_COLOR);
    } catch {
      // Игрок уже вышел.
    }
  }
}
