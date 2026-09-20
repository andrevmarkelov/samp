import { STREET_WORLD } from "../spawn/point";
import { ORG_FBI_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const BLACK = 0;
const DENY = "Вы не состоите в FBI.";

const FBI_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
}> = [
  { model: 490, x: 621.9843, y: -1445.6748, z: 14.3362, angle: 180.3496 },
  { model: 490, x: 621.9604, y: -1470.1604, z: 14.5914, angle: 179.7295 },
  { model: 490, x: 597.2417, y: -1519.1417, z: 15.2019, angle: 271.4967 },
  { model: 490, x: 597.1143, y: -1514.7886, z: 15.2458, angle: 270.7439 },
  { model: 490, x: 597.1077, y: -1510.4407, z: 15.2602, angle: 269.9547 },
  { model: 490, x: 597.1288, y: -1505.885, z: 15.2749, angle: 269.2738 },
  { model: 490, x: 597.0479, y: -1501.2935, z: 15.2904, angle: 269.4644 },
  { model: 415, x: 591.8984, y: -1490.6156, z: 15.0852, angle: 270.3469 },
  { model: 415, x: 599.6034, y: -1490.5652, z: 14.8676, angle: 270.8626 },
  { model: 560, x: 596.3918, y: -1422.7373, z: 13.4693, angle: 274.8309 },
  { model: 560, x: 606.1831, y: -1421.9963, z: 13.4656, angle: 274.1085 },
  { model: 487, x: 597.4208, y: -1441.3842, z: 80.3492, angle: 267.1091 },
];

export function spawnFbiVehicles(): void {
  for (const spot of FBI_VEHICLES) {
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: BLACK,
      color2: BLACK,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_FBI_ID, DENY);
    }
  }
}
