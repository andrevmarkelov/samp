import { Vehicle, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";

const PLAYER_STATE_DRIVER = 2;
/** Left Ctrl. KEY_ACTION = 1. */
const KEY_ACTION = 1;
/** LMB. KEY_FIRE = 4. В pawn на этой клавише фары. */
const KEY_FIRE = 4;
const PARAM_ON = 1;
const PARAM_OFF = 0;
const LIGHTS_SOUND_ID = 4604;

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
    setEngine(vehicle, false, false);
  }

  omp.on("vehicleSpawn", (vehicle) => {
    setEngine(vehicle, false, false);
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_ACTION) !== 0) {
      toggleEngine(player);
    }

    if ((pressed & KEY_FIRE) !== 0) {
      toggleLights(player);
    }
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
    setEngine(vehicle, false, false);
  } catch {
    // Машина уже в мире — параметры догонятся на vehicleSpawn.
  }

  return vehicle;
}

function setEngine(vehicle: Vehicle, on: boolean, lights?: boolean): void {
  try {
    const params = vehicle.getParamsEx();
    vehicle.setParamsEx(
      on ? PARAM_ON : PARAM_OFF,
      lights === undefined ? asParam(params.lights) : lights ? PARAM_ON : PARAM_OFF,
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

function setLights(vehicle: Vehicle, on: boolean): void {
  try {
    const params = vehicle.getParamsEx();
    vehicle.setParamsEx(
      asParam(params.engine),
      on ? PARAM_ON : PARAM_OFF,
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

function driverVehicle(player: Player): Vehicle | null {
  if (!isAuthenticated(player)) {
    return null;
  }

  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return null;
    }

    return omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return null;
  }
}

function toggleEngine(player: Player): void {
  const vehicle = driverVehicle(player);
  if (!vehicle) {
    return;
  }

  const running = isEngineOn(vehicle);
  setEngine(vehicle, !running, !running);
  try {
    player.sendClientMessage(
      Color.info,
      running ? "Двигатель заглушен." : "Двигатель запущен."
    );
  } catch {
    // Игрок уже вышел.
  }
}

function toggleLights(player: Player): void {
  const vehicle = driverVehicle(player);
  if (!vehicle) {
    return;
  }

  const on = isLightsOn(vehicle);
  setLights(vehicle, !on);
  playToggleSound(player);
}

function playToggleSound(player: Player): void {
  try {
    const pos = player.getPos();
    player.playGameSound(LIGHTS_SOUND_ID, pos.x, pos.y, pos.z);
  } catch {
    try {
      player.playGameSound(LIGHTS_SOUND_ID, 0, 0, 0);
    } catch {
      // Слот пустой.
    }
  }
}

export function isEngineOn(vehicle: Vehicle): boolean {
  try {
    return vehicle.getParamsEx().engine === PARAM_ON;
  } catch {
    return false;
  }
}

export function isLightsOn(vehicle: Vehicle): boolean {
  try {
    return vehicle.getParamsEx().lights === PARAM_ON;
  } catch {
    return false;
  }
}

function asParam(value: number): number {
  return value === PARAM_ON ? PARAM_ON : PARAM_OFF;
}
