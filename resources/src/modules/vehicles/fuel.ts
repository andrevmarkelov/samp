import { omp, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { DEFAULT_VEHICLE_FUEL } from "./player-vehicles";
import {
  isEngineOn,
  setEngineStartBlocker,
  setVehicleEngine,
} from "./spawn";

export const MAX_VEHICLE_FUEL = DEFAULT_VEHICLE_FUEL;

type EngineExtraBlocker = (player: Player, vehicle: Vehicle) => string | null;

/** Доп. блок запуска (АЗС и т.п.) — без циклических импортов. */
let extraEngineBlocker: EngineExtraBlocker | null = null;

export function setExtraEngineBlocker(blocker: EngineExtraBlocker | null): void {
  extraEngineBlocker = blocker;
}

/**
 * Полный бак:
 * — ≈ 45 мин езды;
 * — ≈ 90 мин холостого хода (двигатель вкл., водитель внутри);
 * двигатель выкл. — расход 0.
 */
const DRAIN_MOVING_PER_SEC = MAX_VEHICLE_FUEL / (45 * 60);
const DRAIN_IDLE_PER_SEC = MAX_VEHICLE_FUEL / (90 * 60);
const MOVE_SPEED_KMH = 3;
const SPEED_FACTOR = 120.666667;
const TICK_MS = 1000;
const PLAYER_STATE_DRIVER = 2;

const BOATS = new Set([
  430, 446, 452, 453, 454, 472, 473, 484, 493, 595,
]);
const AIRCRAFT = new Set([
  417, 425, 447, 460, 469, 476, 487, 488, 497, 511, 512, 513, 519, 520, 548, 553,
  563, 577, 592, 593,
]);
const BICYCLES = new Set([481, 509, 510]);

/** runtime vehicle id → топливо (дробное). */
const fuelByRuntime = new Map<number, number>();

export function vehicleUsesFuel(model: number): boolean {
  if (AIRCRAFT.has(model) || BOATS.has(model) || BICYCLES.has(model)) {
    return false;
  }

  return model >= 400 && model <= 611;
}

export function normalizeFuel(value: number): number {
  if (!Number.isFinite(value)) {
    return MAX_VEHICLE_FUEL;
  }

  return Math.max(0, Math.min(MAX_VEHICLE_FUEL, value));
}

export function getVehicleFuel(vehicle: Vehicle): number {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return MAX_VEHICLE_FUEL;
  }

  const stored = fuelByRuntime.get(id);
  if (stored === undefined) {
    return MAX_VEHICLE_FUEL;
  }

  return normalizeFuel(stored);
}

export function setVehicleFuel(vehicle: Vehicle, fuel: number): void {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return;
  }

  let model = 0;
  try {
    model = vehicle.getModel();
  } catch {
    return;
  }

  if (!vehicleUsesFuel(model)) {
    fuelByRuntime.delete(id);
    return;
  }

  fuelByRuntime.set(id, normalizeFuel(fuel));
}

export function clearVehicleFuel(runtimeId: number): void {
  fuelByRuntime.delete(runtimeId);
}

export function startFuelSystem(): void {
  setEngineStartBlocker((player, vehicle) => {
    const extra = extraEngineBlocker?.(player, vehicle);
    if (extra) {
      return extra;
    }

    let model = 0;
    try {
      model = vehicle.getModel();
    } catch {
      return null;
    }

    if (!vehicleUsesFuel(model)) {
      return null;
    }

    if (getVehicleFuel(vehicle) <= 0) {
      return "Бак пуст. Заправьтесь на АЗС (сигнал H у колонки).";
    }

    return null;
  });

  omp.on("vehicleSpawn", (vehicle) => {
    const id = liveVehicleId(vehicle);
    if (id === null || fuelByRuntime.has(id)) {
      return;
    }

    let model = 0;
    try {
      model = vehicle.getModel();
    } catch {
      return;
    }

    if (vehicleUsesFuel(model)) {
      fuelByRuntime.set(id, MAX_VEHICLE_FUEL);
    }
  });

  setInterval(tickFuel, TICK_MS);
}

function tickFuel(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_DRIVER) {
        return;
      }
    } catch {
      return;
    }

    const vehicle = driverVehicle(player);
    if (!vehicle || !isEngineOn(vehicle)) {
      return;
    }

    let model = 0;
    try {
      model = vehicle.getModel();
    } catch {
      return;
    }

    if (!vehicleUsesFuel(model)) {
      return;
    }

    const id = liveVehicleId(vehicle);
    if (id === null) {
      return;
    }

    if (!fuelByRuntime.has(id)) {
      fuelByRuntime.set(id, MAX_VEHICLE_FUEL);
    }

    const speed = vehicleSpeedKmh(vehicle);
    const burn =
      speed >= MOVE_SPEED_KMH ? DRAIN_MOVING_PER_SEC : DRAIN_IDLE_PER_SEC;
    const prev = fuelByRuntime.get(id) ?? MAX_VEHICLE_FUEL;
    const next = normalizeFuel(prev - burn);
    fuelByRuntime.set(id, next);

    if (next > 0) {
      return;
    }

    setVehicleEngine(vehicle, false, false);
    try {
      player.sendClientMessage(
        Color.error,
        "Бензин закончился. Двигатель заглушен."
      );
    } catch {
      // Уже вышел.
    }
  });
}

function driverVehicle(player: Player): Vehicle | null {
  try {
    if (!player.isInAnyVehicle()) {
      return null;
    }

    return omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return null;
  }
}

function vehicleSpeedKmh(vehicle: Vehicle): number {
  try {
    const vel = vehicle.getVelocity();
    const vx = vel.x ?? 0;
    const vy = vel.y ?? 0;
    const vz = vel.z ?? 0;
    return Math.sqrt(vx * vx + vy * vy + vz * vz) * SPEED_FACTOR;
  } catch {
    return 0;
  }
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    if (id === null || id === undefined) {
      return null;
    }

    const numeric = Number(id);
    return Number.isInteger(numeric) ? numeric : null;
  } catch {
    return null;
  }
}
