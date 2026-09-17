import { STREET_WORLD } from "../spawn/point";
import {
  ORG_AZTECAS_ID,
  ORG_BALLAS_ID,
  ORG_GROVE_ID,
  ORG_RIFA_ID,
  ORG_VAGOS_ID,
} from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;

type GangCar = {
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
};

const GROVE_CARS: readonly GangCar[] = [
  { model: 492, x: 2493.8, y: -1681.2, z: 13.2, angle: 0, color1: 86, color2: 86 },
  { model: 492, x: 2489.6001, y: -1680.8, z: 13.2, angle: 0, color1: 86, color2: 86 },
  { model: 492, x: 2485.8, y: -1680.7, z: 13.2, angle: 0, color1: 86, color2: 86 },
  { model: 492, x: 2475.5, y: -1676.5, z: 13.2, angle: 328, color1: 86, color2: 86 },
  { model: 492, x: 2472.3999, y: -1671.5, z: 13.2, angle: 307.997, color1: 86, color2: 86 },
];

const BALLAS_CARS: readonly GangCar[] = [
  { model: 491, x: 2036.2, y: -1128.9, z: 24.4, angle: 270, color1: 147, color2: 147 },
  { model: 491, x: 2029.1, y: -1129, z: 24.6, angle: 270, color1: 147, color2: 147 },
  { model: 491, x: 2018.4, y: -1128.6, z: 24.9, angle: 270, color1: 147, color2: 147 },
  { model: 491, x: 2015.6, y: -1143.3, z: 25, angle: 272, color1: 147, color2: 147 },
  { model: 491, x: 2024.1, y: -1143.1, z: 24.7, angle: 272, color1: 147, color2: 147 },
  { model: 491, x: 2032.8, y: -1143, z: 24.5, angle: 272, color1: 147, color2: 147 },
  { model: 491, x: 2040.8, y: -1143.2, z: 24.2, angle: 272, color1: 147, color2: 147 },
];

const AZTECAS_CARS: readonly GangCar[] = [
  { model: 534, x: 2168.8999, y: -1807, z: 13.2, angle: 0, color1: 165, color2: 165 },
  { model: 534, x: 2165.1001, y: -1806.9, z: 13.2, angle: 0, color1: 165, color2: 165 },
  { model: 534, x: 2161.1001, y: -1806.9, z: 13.2, angle: 0, color1: 165, color2: 165 },
  { model: 534, x: 2157.1001, y: -1807, z: 13.2, angle: 0, color1: 165, color2: 165 },
  { model: 534, x: 2173.1001, y: -1806.7, z: 13.2, angle: 0, color1: 165, color2: 165 },
  { model: 536, x: 2159.3, y: -1792.9, z: 13.2, angle: 270, color1: 165, color2: 165 },
  { model: 536, x: 2159.1001, y: -1797, z: 13.2, angle: 270, color1: 165, color2: 165 },
];

const VAGOS_CARS: readonly GangCar[] = [
  { model: 467, x: 2761.1113, y: -1177.4034, z: 69.1072, angle: 90.9622, color1: 6, color2: 1 },
  { model: 474, x: 2742.7019, y: -1188.0476, z: 69.0791, angle: 0.6235, color1: 6, color2: 6 },
  { model: 474, x: 2742.1958, y: -1166.217, z: 69.1452, angle: 2.7342, color1: 6, color2: 6 },
  { model: 474, x: 2742.1863, y: -1149.0377, z: 69.2538, angle: 0.2541, color1: 6, color2: 6 },
  { model: 474, x: 2742.0378, y: -1134.9971, z: 69.2553, angle: 0.2727, color1: 6, color2: 6 },
];

const RIFA_CARS: readonly GangCar[] = [
  { model: 439, x: 2774.0278, y: -1907.8258, z: 11.6699, angle: 0.3627, color1: 198, color2: 198 },
  { model: 439, x: 2774.1218, y: -1919.3033, z: 12.9702, angle: 1.0832, color1: 198, color2: 198 },
  { model: 439, x: 2774.0767, y: -1932.5342, z: 13.3059, angle: 0.4862, color1: 198, color2: 198 },
  { model: 439, x: 2774.3379, y: -1950.8381, z: 13.3063, angle: 1.4531, color1: 198, color2: 198 },
  { model: 566, x: 2763.9497, y: -1911.0905, z: 11.9163, angle: 0.3543, color1: 198, color2: 198 },
  { model: 566, x: 2764.1392, y: -1923.2371, z: 13.1346, angle: 0.6155, color1: 198, color2: 198 },
  { model: 566, x: 2764.4043, y: -1935.8153, z: 13.1914, angle: 0.3832, color1: 198, color2: 198 },
  { model: 566, x: 2764.5476, y: -1945.1934, z: 13.1941, angle: 0.4081, color1: 198, color2: 198 },
];

function spawnFleet(orgId: number, deny: string, cars: readonly GangCar[]): void {
  for (const spot of cars) {
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
      registerOrgVehicle(vehicle, orgId, deny);
    }
  }
}

export function spawnGangVehicles(): void {
  spawnFleet(ORG_GROVE_ID, "Vy ne sostoite v Grove Street.", GROVE_CARS);
  spawnFleet(ORG_BALLAS_ID, "Vy ne sostoite v The Ballas.", BALLAS_CARS);
  spawnFleet(ORG_AZTECAS_ID, "Vy ne sostoite v Varios Los Aztecas.", AZTECAS_CARS);
  spawnFleet(ORG_VAGOS_ID, "Vy ne sostoite v Los Santos Vagos.", VAGOS_CARS);
  spawnFleet(ORG_RIFA_ID, "Vy ne sostoite v The Rifa.", RIFA_CARS);
}
