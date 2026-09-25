import { STREET_WORLD } from "../spawn/point";
import { ORG_LSPD_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const DENY = "Вы не состоите в LSPD.";

function policeColors(model: number): { color1: number; color2: number } {
  if (model === 415) {
    return { color1: 1, color2: 1 };
  }

  return { color1: 0, color2: 1 };
}

const LSPD_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
}> = [
  { model: 596, x: 1535.8173, y: -1677.04, z: 13.0678, angle: 0 },
  { model: 596, x: 1535.8173, y: -1667.922, z: 13.0678, angle: 0 },
  { model: 596, x: 1583.4456, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1574.5582, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1570.3405, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1564.6013, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1558.9061, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1578.6102, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1587.5282, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1591.4902, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 596, x: 1595.5084, y: -1710.8175, z: 5.5943, angle: 0 },
  { model: 601, x: 1526.3522, y: -1644.9253, z: 5.6496, angle: 180 },
  { model: 601, x: 1530.4468, y: -1644.9253, z: 5.6496, angle: 180 },
  { model: 599, x: 1545.6602, y: -1650.9991, z: 6.0141, angle: 90 },
  { model: 599, x: 1545.6602, y: -1655.0815, z: 6.0141, angle: 90 },
  { model: 599, x: 1545.6602, y: -1659.0333, z: 6.0141, angle: 90 },
  { model: 427, x: 1534.6112, y: -1645.2471, z: 5.8902, angle: 180 },
  { model: 427, x: 1538.7426, y: -1645.2471, z: 5.8902, angle: 180 },
  { model: 415, x: 1528.371, y: -1688.0734, z: 5.5958, angle: -90 },
  { model: 415, x: 1528.371, y: -1683.986, z: 5.5958, angle: -90 },
  { model: 523, x: 1546.2515, y: -1663.0503, z: 5.3935, angle: 90 },
  { model: 523, x: 1546.2515, y: -1668.0117, z: 5.3935, angle: 90 },
  { model: 523, x: 1546.2515, y: -1672.0693, z: 5.3935, angle: 90 },
  { model: 523, x: 1546.2515, y: -1676.1163, z: 5.3935, angle: 90 },
  { model: 523, x: 1546.2515, y: -1680.2988, z: 5.3935, angle: 90 },
  { model: 523, x: 1546.2515, y: -1684.3185, z: 5.3935, angle: 90 },
  { model: 497, x: 1550.4297, y: -1643.9872, z: 28.5601, angle: 90 },
];

export function spawnLspdVehicles(): void {
  for (const spot of LSPD_VEHICLES) {
    const colors = policeColors(spot.model);
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: colors.color1,
      color2: colors.color2,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
      siren: spot.model === 415,
      lightBar: spot.model === 415,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_LSPD_ID, DENY);
    }
  }
}
