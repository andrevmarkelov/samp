import type { Vehicle } from "@omp-node/core";
import { STREET_WORLD } from "../../spawn/point";
import { registerJobVehicle } from "../../vehicles/access";
import { createServerVehicle } from "../../vehicles/spawn";
import { JOB_BUS_DRIVER } from "../catalog";

const BUS_MODEL = 431;
const RESPAWN_SEC = 100;
const COLOR = -1;
const DENY = "Этот автобус только для водителей автобуса.";

export type BusSpawnSpot = {
  x: number;
  y: number;
  z: number;
  angle: number;
};

const BUS_SPOTS: readonly BusSpawnSpot[] = [
  { x: 1275.3092, y: -1796.618, z: 13.3833, angle: 90 },
  { x: 1275.3092, y: -1802.2687, z: 13.3833, angle: 90 },
  { x: 1275.3092, y: -1807.8944, z: 13.3833, angle: 90 },
  { x: 1275.3092, y: -1813.3391, z: 13.3833, angle: 90 },
  { x: 1275.3092, y: -1818.8633, z: 13.3833, angle: 90 },
];

/** vehicleId → парковочное место. */
const spawnByVehicleId = new Map<number, BusSpawnSpot>();

export function spawnBusJobVehicles(): void {
  for (const spot of BUS_SPOTS) {
    const vehicle = createServerVehicle({
      model: BUS_MODEL,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: COLOR,
      color2: COLOR,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (!vehicle) {
      continue;
    }

    registerJobVehicle(vehicle, JOB_BUS_DRIVER, DENY);
    rememberSpawn(vehicle, spot);
  }
}

function rememberSpawn(vehicle: Vehicle, spot: BusSpawnSpot, retried = false): void {
  try {
    const id = Number(vehicle.getID());
    if (Number.isInteger(id)) {
      spawnByVehicleId.set(id, spot);
      return;
    }
  } catch {
    // id ещё не готов.
  }

  if (!retried) {
    setTimeout(() => rememberSpawn(vehicle, spot, true), 0);
  }
}

export function busSpawnSpot(vehicle: Vehicle): BusSpawnSpot | null {
  try {
    const id = Number(vehicle.getID());
    if (!Number.isInteger(id)) {
      return null;
    }
    return spawnByVehicleId.get(id) ?? null;
  } catch {
    return null;
  }
}

export function isBusJobVehicle(vehicle: Vehicle): boolean {
  return busSpawnSpot(vehicle) !== null;
}
