import { STREET_WORLD } from "../spawn/point";
import type { GameModule } from "../types";
import { bindOrgVehicleAccess } from "./access";
import { spawnArmyVehicles } from "./army";
import { spawnGangVehicles } from "./gangs";
import { spawnHospitalVehicles } from "./hospital";
import { spawnMeriyaVehicles } from "./meriya";
import { startSpeedLimiter } from "./limit";
import { createServerVehicle, startEngineControl } from "./spawn";

export { createServerVehicle } from "./spawn";
export type { ServerVehicleDef } from "./spawn";

/** GTA SA Faggio. */
const FAGGIO = 462;
const GREEN = 191;
const RESPAWN_SEC = 100;

const STATION_SCOOTERS: ReadonlyArray<{ y: number }> = [
  { y: -1933.9576 },
  { y: -1932.3636 },
  { y: -1930.7528 },
  { y: -1929.1544 },
  { y: -1927.5529 },
  { y: -1925.9482 },
  { y: -1924.3556 },
  { y: -1922.7563 },
  { y: -1921.1459 },
  { y: -1919.5436 },
  { y: -1917.9432 },
];

export const vehiclesModule: GameModule = {
  name: "vehicles",
  start() {
    startEngineControl();
    startSpeedLimiter();
    bindOrgVehicleAccess();
    spawnArmyVehicles();
    spawnHospitalVehicles();
    spawnMeriyaVehicles();
    spawnGangVehicles();

    for (const spot of STATION_SCOOTERS) {
      createServerVehicle({
        model: FAGGIO,
        x: 1775.908,
        y: spot.y,
        z: 12.887,
        angle: -90,
        color1: GREEN,
        color2: GREEN,
        respawnSec: RESPAWN_SEC,
        world: STREET_WORLD,
      });
    }
  },
};
