import { STREET_WORLD } from "../spawn/point";
import { ORG_AUTOSCHOOL_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";
import type { Vehicle } from "@omp-node/core";

const RESPAWN_SEC = 100;
const DENY = "Vy ne sostoite v avtoshkole.";

const AUTOSCHOOL_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 426, x: 703.8824, y: -1436.6838, z: 13.2825, angle: 1.6552, color1: 124, color2: 124 },
  { model: 426, x: 707.1514, y: -1436.517, z: 13.2821, angle: 3.3001, color1: 124, color2: 124 },
  { model: 426, x: 710.5106, y: -1436.3472, z: 13.2785, angle: 2.559, color1: 124, color2: 124 },
  { model: 426, x: 714.0829, y: -1436.1199, z: 13.2822, angle: 1.377, color1: 124, color2: 124 },
  { model: 426, x: 717.7269, y: -1435.9945, z: 13.2822, angle: 2.6545, color1: 124, color2: 124 },
  { model: 586, x: 741.8104, y: -1437.6473, z: 13.0591, angle: 359.7747, color1: 124, color2: 124 },
  { model: 586, x: 739.9639, y: -1437.6268, z: 13.0593, angle: 358.4854, color1: 124, color2: 124 },
  { model: 586, x: 738.0773, y: -1437.6799, z: 13.0593, angle: 1.4093, color1: 124, color2: 124 },
  { model: 586, x: 736.2259, y: -1437.7104, z: 13.0594, angle: 2.3909, color1: 124, color2: 124 },
  { model: 586, x: 734.3732, y: -1437.7587, z: 13.0593, angle: 3.2824, color1: 124, color2: 124 },
];

export function spawnAutoschoolVehicles(): void {
  for (const spot of AUTOSCHOOL_VEHICLES) {
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: spot.color1,
      color2: spot.color2,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_AUTOSCHOOL_ID, DENY);
      rememberFleet(vehicle);
    }
  }
}

const fleetIds = new Set<number>();

function rememberFleet(vehicle: Vehicle, retried = false): void {
  try {
    const id = vehicle.getID();
    if (id === null || id === undefined) {
      if (!retried) {
        setTimeout(() => {
          rememberFleet(vehicle, true);
        }, 0);
      }
      return;
    }

    fleetIds.add(Number(id));
  } catch {
    // Transport uzhe unichtozhen.
  }
}

export function isAutoschoolFleetVehicle(vehicle: Vehicle): boolean {
  try {
    const id = vehicle.getID();
    return id !== null && id !== undefined && fleetIds.has(Number(id));
  } catch {
    return false;
  }
}
