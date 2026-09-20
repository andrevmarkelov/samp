import { STREET_WORLD } from "../spawn/point";
import { ORG_MERIYA_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const WHITE = 1;
const DENY = "Вы не состоите в мэрии.";

const MERIYA_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
}> = [
  { model: 421, x: 1404.2231, y: -1805.9167, z: 13.3617, angle: 90 },
  { model: 421, x: 1404.2231, y: -1802.525, z: 13.3617, angle: 90 },
  { model: 421, x: 1404.2231, y: -1798.9406, z: 13.3617, angle: 90 },
  { model: 421, x: 1404.2231, y: -1795.2881, z: 13.3617, angle: 90 },
  { model: 400, x: 1403.6168, y: -1774.3704, z: 13.5477, angle: 90 },
  { model: 400, x: 1403.6168, y: -1777.938, z: 13.5477, angle: 90 },
  { model: 400, x: 1403.6168, y: -1781.5233, z: 13.5477, angle: 90 },
  { model: 400, x: 1403.6168, y: -1785.214, z: 13.5477, angle: 90 },
  { model: 409, x: 1445.3724, y: -1838.2976, z: 13.2538, angle: 90 },
  { model: 487, x: 1429.3929, y: -1814.4855, z: 33.534, angle: 180 },
];

export function spawnMeriyaVehicles(): void {
  for (const spot of MERIYA_VEHICLES) {
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: WHITE,
      color2: WHITE,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_MERIYA_ID, DENY);
    }
  }
}
