import { STREET_WORLD } from "../spawn/point";
import { ORG_RADIO_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";
import type { Vehicle } from "@omp-node/core";

const RESPAWN_SEC = 100;
const DENY = "Вы не состоите в радиоцентре.";

const RADIO_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 488, x: 1824.0616, y: -1283.7408, z: 131.9412, angle: 0.6596, color1: 1, color2: 152 },
  { model: 582, x: 1769.0417, y: -1314.2787, z: 13.6746, angle: 90.4253, color1: 152, color2: 1 },
  { model: 582, x: 1768.9852, y: -1310.9741, z: 13.7004, angle: 89.934, color1: 152, color2: 1 },
  { model: 582, x: 1768.984, y: -1307.7222, z: 13.7365, angle: 90.3538, color1: 152, color2: 1 },
  { model: 582, x: 1768.9139, y: -1304.2813, z: 13.7484, angle: 90.5425, color1: 152, color2: 1 },
];

const fleetIds = new Set<number>();

export function spawnRadioVehicles(): void {
  for (const spot of RADIO_VEHICLES) {
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
      registerOrgVehicle(vehicle, ORG_RADIO_ID, DENY);
      rememberFleet(vehicle);
    }
  }
}

export function isRadioFleetVehicle(vehicle: Vehicle): boolean {
  try {
    const id = vehicle.getID();
    return id !== null && id !== undefined && fleetIds.has(Number(id));
  } catch {
    return false;
  }
}

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
    // Транспорт уже уничтожен.
  }
}
