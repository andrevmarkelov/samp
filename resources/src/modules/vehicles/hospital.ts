import { STREET_WORLD } from "../spawn/point";
import { ORG_HOSPITAL_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const DENY = "Vy ne sostoite v bol'nice.";

const HOSPITAL_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 416, x: 1178.4301, y: -1338.7181, z: 14.0219, angle: 270.9369, color1: 1, color2: 3 },
  { model: 416, x: 1177.8186, y: -1308.4728, z: 14.0036, angle: 269.4774, color1: 1, color2: 3 },
  { model: 416, x: 1123.9796, y: -1329.4818, z: 13.3585, angle: 0.0023, color1: 1, color2: 3 },
  { model: 416, x: 1110.9613, y: -1329.5452, z: 13.3534, angle: 1.2558, color1: 1, color2: 3 },
  { model: 416, x: 1097.9508, y: -1329.6621, z: 13.3435, angle: 0.5626, color1: 1, color2: 3 },
  { model: 487, x: 1160.7632, y: -1312.3269, z: 31.672, angle: 269.5352, color1: 1, color2: 3 },
  { model: 490, x: 1134.9924, y: -1341.257, z: 13.8918, angle: 0.1497, color1: 3, color2: 1 },
  { model: 490, x: 1139.4137, y: -1341.215, z: 13.8255, angle: 0.764, color1: 3, color2: 1 },
];

export function spawnHospitalVehicles(): void {
  for (const spot of HOSPITAL_VEHICLES) {
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
      registerOrgVehicle(vehicle, ORG_HOSPITAL_ID, DENY);
    }
  }
}
