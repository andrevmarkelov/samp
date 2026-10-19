import { omp, TextLabel, type Vehicle } from "@omp-node/core";
import { Color } from "../../../shared/colors";
import { STREET_WORLD } from "../../spawn/point";
import { registerJobVehicle } from "../../vehicles/access";
import { createServerVehicle } from "../../vehicles/spawn";
import { JOB_FIREFIGHTER } from "../catalog";

const MODEL = 407;
const RESPAWN_SEC = 1800;
const COLOR_1 = 3;
const COLOR_2 = 1;
const DENY = "Эта машина только для пожарных.";
const LABEL_OFFSET_Z = 2.2;
const LABEL_DRAW_DISTANCE = 35;

/**
 * 3 очага × 100 ед. × 10 л = 300 л на пожар.
 * Полный бак — ровно три таких выезда.
 */
export const MAX_TRUCK_WATER = 900;

type TruckSpot = { x: number; y: number; z: number; angle: number };

const SPOTS: readonly TruckSpot[] = [
  { x: 1704.6843, y: -1505.8027, z: 13.7169, angle: 89.9977 },
  { x: 1704.6725, y: -1501.4993, z: 13.7068, angle: 89.7148 },
  { x: 1704.7207, y: -1497.2748, z: 13.6332, angle: 89.98 },
  { x: 1704.7301, y: -1492.8673, z: 13.7087, angle: 89.9841 },
  { x: 1704.8073, y: -1488.5905, z: 13.7099, angle: 89.8386 },
  { x: 1704.9872, y: -1484.1857, z: 13.7303, angle: 89.776 },
];

type TruckState = {
  water: number;
  label: TextLabel | null;
};

const trucks = new Map<number, TruckState>();

export function spawnFireTrucks(): void {
  for (const spot of SPOTS) {
    const vehicle = createServerVehicle({
      model: MODEL,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: COLOR_1,
      color2: COLOR_2,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (!vehicle) {
      continue;
    }

    registerJobVehicle(vehicle, JOB_FIREFIGHTER, DENY);
    remember(vehicle);
  }
}

export function bindFireTruckWater(): void {
  omp.on("vehicleSpawn", (vehicle) => {
    const id = liveId(vehicle);
    if (id === null || !trucks.has(id)) {
      return;
    }

    const state = trucks.get(id);
    if (!state) {
      return;
    }

    state.water = 0;
    destroyLabel(state);
    attachLabel(vehicle, state);
  });
}

export function isFireTruck(vehicle: Vehicle): boolean {
  const id = liveId(vehicle);
  return id !== null && trucks.has(id);
}

export function isFireTruckId(id: number): boolean {
  return trucks.has(id);
}

export function fireTruckId(vehicle: Vehicle): number | null {
  const id = liveId(vehicle);
  if (id === null || !trucks.has(id)) {
    return null;
  }
  return id;
}

export function getTruckWater(id: number): number {
  return trucks.get(id)?.water ?? 0;
}

export function setTruckWater(id: number, water: number): void {
  const state = trucks.get(id);
  if (!state) {
    return;
  }

  state.water = Math.max(0, Math.min(MAX_TRUCK_WATER, Math.floor(water)));
  const vehicle = omp.vehicles.at(id);
  if (!state.label && vehicle) {
    attachLabel(vehicle, state);
    return;
  }

  try {
    state.label?.updateText(Color.white, waterLabel(state.water));
  } catch {
    state.label = null;
    if (vehicle) {
      attachLabel(vehicle, state);
    }
  }
}

function remember(vehicle: Vehicle, retried = false): void {
  const id = liveId(vehicle);
  if (id === null) {
    if (!retried) {
      setTimeout(() => remember(vehicle, true), 0);
    }
    return;
  }

  const state: TruckState = { water: 0, label: null };
  trucks.set(id, state);
  attachLabel(vehicle, state);
}

function attachLabel(vehicle: Vehicle, state: TruckState): void {
  destroyLabel(state);

  try {
    const pos = vehicle.getPos();
    const label = new TextLabel(
      waterLabel(state.water),
      Color.white,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );
    label.attachToVehicle(vehicle, 0, 0, LABEL_OFFSET_Z);
    state.label = label;
  } catch {
    state.label = null;
  }
}

function destroyLabel(state: TruckState): void {
  if (!state.label) {
    return;
  }

  try {
    state.label.destroy();
  } catch {
    // Уже снят.
  }
  state.label = null;
}

function waterLabel(water: number): string {
  if (water <= 0) {
    return "{FF6347}Пожарная машина\n{FFFFFF}Бак пуст";
  }

  if (water >= MAX_TRUCK_WATER) {
    return `{33CC66}Пожарная машина\n{FFFFFF}Бак полный: ${MAX_TRUCK_WATER} л`;
  }

  return `{33CCFF}Пожарная машина\n{FFFFFF}Вода: ${water} / ${MAX_TRUCK_WATER} л`;
}

function liveId(vehicle: Vehicle): number | null {
  try {
    const id = Number(vehicle.getID());
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}
