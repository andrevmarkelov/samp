import { STREET_WORLD } from "../spawn/point";
import { LAW_ORG_IDS } from "../org/lspd";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 1800;
const DENY = "Sest' mogut sotrudniki LSPD, oblastnoy policii i FBI.";

const PRISON_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 528, x: 1795.1833, y: -1592.5132, z: 13.5432, angle: 307.9825, color1: 1, color2: 1 },
  { model: 427, x: 1801.6245, y: -1587.4371, z: 13.5027, angle: 307.9825, color1: 159, color2: 198 },
  { model: 599, x: 1807.5057, y: -1582.8274, z: 13.6155, angle: 307.9825, color1: 159, color2: 198 },
];

export function spawnPrisonVehicles(): void {
  for (const spot of PRISON_VEHICLES) {
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
      registerOrgVehicle(vehicle, LAW_ORG_IDS, DENY);
    }
  }
}
