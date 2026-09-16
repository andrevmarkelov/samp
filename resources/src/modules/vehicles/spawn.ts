import { Vehicle, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";

const PLAYER_STATE_DRIVER = 2;
/** Left Ctrl. KEY_ACTION = 1. */
const KEY_ACTION = 1;
const PARAM_ON = 1;
const PARAM_OFF = 0;

export type ServerVehicleDef = {
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
  respawnSec: number;
  world?: number;
  siren?: boolean;
};

/** Ручной двигатель для всего транспорта на сервере. */
export function startEngineControl(): void {
  try {
    Vehicle.useManualEngineAndLights();
  } catch {
    // Ядро уже в ручном режиме.
  }

  for (const vehicle of omp.vehicles.all()) {
    setEngine(vehicle, false);
  }

  omp.on("vehicleSpawn", (vehicle) => {
    setEngine(vehicle, false);
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_ACTION) === 0) {
      return;
    }

    toggleEngine(player);
  });
}

/** Единственная точка спавна транспорта: мир, двигатель выключен. */
export function createServerVehicle(def: ServerVehicleDef): Vehicle | null {
  let vehicle: Vehicle;
  try {
    vehicle = new Vehicle(
      def.model,
      def.x,
      def.y,
      def.z,
      def.angle,
      def.color1,
      def.color2,
      def.respawnSec,
      def.siren ?? false
    );
  } catch {
    return null;
  }

  try {
    vehicle.setVirtualWorld(def.world ?? STREET_WORLD);
    setEngine(vehicle, false);
  } catch {
    // Машина уже в мире — параметры догонятся на vehicleSpawn.
  }

  return vehicle;
}

function setEngine(vehicle: Vehicle, on: boolean): void {
  try {
    const params = vehicle.getParamsEx();
    vehicle.setParamsEx(
      on ? PARAM_ON : PARAM_OFF,
      asParam(params.lights),
      asParam(params.alarm),
      asParam(params.doors),
      asParam(params.bonnet),
      asParam(params.boot),
      asParam(params.objective)
    );
  } catch {
    // Транспорт уже уничтожен.
  }
}

function toggleEngine(player: Player): void {
  if (!isAuthenticated(player)) {
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return;
    }

    const vehicle = omp.vehicles.at(player.getVehicleID());
    if (!vehicle) {
      return;
    }

    const running = isEngineOn(vehicle);
    setEngine(vehicle, !running);
    player.sendClientMessage(
      Color.info,
      running ? "Dvigatel' zaglushen." : "Dvigatel' zapushchen."
    );
  } catch {
    // Игрок уже вышел.
  }
}

export function isEngineOn(vehicle: Vehicle): boolean {
  try {
    return vehicle.getParamsEx().engine === PARAM_ON;
  } catch {
    return false;
  }
}

function asParam(value: number): number {
  return value === PARAM_ON ? PARAM_ON : PARAM_OFF;
}
