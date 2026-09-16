import { INVALID_VEHICLE_ID, omp, type Vehicle } from "@omp-node/core";

const TICK_MS = 100;
const SPEED_FACTOR = 120.666667;
export const MIN_SPEED_LIMIT = 10;
export const MAX_SPEED_LIMIT = 200;

type LimitEntry = {
  kmh: number;
  ptr: number | null;
};

const limits = new Map<number, LimitEntry>();
let ticker: ReturnType<typeof setInterval> | null = null;

export function startSpeedLimiter(): void {
  omp.on("vehicleSpawn", (vehicle) => {
    clearVehicleLimit(vehicle);
  });

  omp.on("vehicleDeath", (vehicle) => {
    clearVehicleLimit(vehicle);
  });
}

export function getVehicleLimit(vehicle: Vehicle): number | null {
  return entryFor(vehicle)?.kmh ?? null;
}

export function setVehicleLimit(vehicle: Vehicle, kmh: number): number | null {
  const id = liveVehicleId(vehicle);
  const ptr = vehiclePtr(vehicle);
  if (id === null || ptr === null) {
    return null;
  }

  const capped = Math.min(MAX_SPEED_LIMIT, Math.max(MIN_SPEED_LIMIT, Math.floor(kmh)));
  limits.set(id, { kmh: capped, ptr });
  ensureTicker();
  return capped;
}

export function clearVehicleLimit(vehicle: Vehicle): void {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return;
  }

  limits.delete(id);
  if (limits.size === 0) {
    stopTicker();
  }
}

function entryFor(vehicle: Vehicle): LimitEntry | null {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return null;
  }

  const entry = limits.get(id);
  if (!entry) {
    return null;
  }

  const ptr = vehiclePtr(vehicle);
  if (ptr === null || entry.ptr !== ptr) {
    limits.delete(id);
    if (limits.size === 0) {
      stopTicker();
    }
    return null;
  }

  return entry;
}

function ensureTicker(): void {
  if (ticker) {
    return;
  }

  ticker = setInterval(applyLimits, TICK_MS);
}

function stopTicker(): void {
  if (!ticker) {
    return;
  }

  clearInterval(ticker);
  ticker = null;
}

function applyLimits(): void {
  if (limits.size === 0) {
    stopTicker();
    return;
  }

  for (const [id, entry] of [...limits]) {
    const vehicle = omp.vehicles.at(id);
    if (!vehicle || vehiclePtr(vehicle) !== entry.ptr) {
      limits.delete(id);
      continue;
    }

    try {
      if (vehicle.isDead()) {
        limits.delete(id);
        continue;
      }
    } catch {
      limits.delete(id);
      continue;
    }

    capVehicle(vehicle, entry.kmh);
  }

  if (limits.size === 0) {
    stopTicker();
  }
}

function capVehicle(vehicle: Vehicle, kmh: number): void {
  try {
    const vel = vehicle.getVelocity();
    const vx = vel.x ?? 0;
    const vy = vel.y ?? 0;
    const vz = vel.z ?? 0;
    const xy = Math.hypot(vx, vy);
    const maxVel = kmh / SPEED_FACTOR;
    if (xy <= maxVel || maxVel <= 0) {
      return;
    }

    const scale = maxVel / xy;
    const motion = vehicle as Vehicle & {
      setVelocity(x: number, y: number, z: number): boolean;
    };
    motion.setVelocity(vx * scale, vy * scale, vz);
  } catch {
    // Транспорт уже уничтожен.
  }
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    if (id === null || id === undefined || id === INVALID_VEHICLE_ID) {
      return null;
    }

    const numeric = Number(id);
    return Number.isInteger(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function vehiclePtr(vehicle: Vehicle): number | null {
  try {
    const ptr = vehicle.getPtr();
    return ptr === null || ptr === undefined ? null : ptr;
  } catch {
    return null;
  }
}
