import { ObjectMp, omp, type Vehicle } from "@omp-node/core";

/** Мигалка на крышу (калибровка Washington 415 в 0,0,0). */
const LIGHT_BAR_MODEL = 19419;
const DRAW_DISTANCE = 300;
const OFFSET_X = 0;
const OFFSET_Y = -0.45;
const OFFSET_Z = 0.6;

const lightBarVehicles = new Set<number>();
const barsByVehicle = new Map<number, ObjectMp>();
let respawnBound = false;

function vehicleId(vehicle: Vehicle): number | null {
  try {
    return vehicle.getID();
  } catch {
    return null;
  }
}

function destroyBar(vehicleIdValue: number): void {
  const object = barsByVehicle.get(vehicleIdValue);
  if (!object) {
    return;
  }

  try {
    object.destroy();
  } catch {
    // Уже уничтожен.
  }

  barsByVehicle.delete(vehicleIdValue);
}

export function bindLightBarRespawn(): void {
  if (respawnBound) {
    return;
  }

  respawnBound = true;
  omp.on("vehicleSpawn", (vehicle) => {
    const id = vehicleId(vehicle);
    if (id === null || !lightBarVehicles.has(id)) {
      return;
    }

    attachLightBar(vehicle);
  });
}

export function attachLightBar(vehicle: Vehicle): boolean {
  const id = vehicleId(vehicle);
  if (id === null) {
    return false;
  }

  lightBarVehicles.add(id);
  destroyBar(id);

  try {
    const pos = vehicle.getPos();
    const object = new ObjectMp(
      LIGHT_BAR_MODEL,
      pos.x,
      pos.y,
      pos.z,
      0,
      0,
      0,
      DRAW_DISTANCE
    );
    object.attachToVehicle(vehicle, OFFSET_X, OFFSET_Y, OFFSET_Z, 0, 0, 0);
    barsByVehicle.set(id, object);
    return true;
  } catch {
    return false;
  }
}
