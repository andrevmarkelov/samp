import { STREET_WORLD } from "../spawn/point";
import { ORG_POLICE_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const DENY = "Вы не состоите в областной полиции.";

const POLICE_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 596, x: 625.6458, y: -610.5199, z: 16.5385, angle: 271.0717, color1: 0, color2: 1 },
  { model: 596, x: 625.5593, y: -606.8709, z: 16.548, angle: 271.3169, color1: 0, color2: 1 },
  { model: 596, x: 625.5553, y: -603.2085, z: 16.5489, angle: 270.7511, color1: 0, color2: 1 },
  { model: 599, x: 613.1907, y: -601.6616, z: 17.4191, angle: 271.6941, color1: 0, color2: 1 },
  { model: 599, x: 613.0422, y: -597.3184, z: 17.423, angle: 271.4464, color1: 0, color2: 1 },
  { model: 596, x: 625.5228, y: -599.5369, z: 16.5515, angle: 270.8548, color1: 0, color2: 1 },
  { model: 596, x: 625.5185, y: -595.856, z: 16.5522, angle: 270.4398, color1: 0, color2: 1 },
  { model: 596, x: 636.0015, y: -559.1108, z: 15.9786, angle: 179.2886, color1: 0, color2: 1 },
  { model: 596, x: 636.0298, y: -579.2421, z: 15.9805, angle: 179.2996, color1: 0, color2: 1 },
  { model: 415, x: 610.6595, y: -591.1507, z: 17.0012, angle: 270.0073, color1: 1, color2: 1 },
  { model: 497, x: 613.103, y: -576.2366, z: 26.3201, angle: 269.5273, color1: 0, color2: 1 },
  { model: 523, x: 640.3466, y: -611.762, z: 15.9081, angle: 0.2653, color1: 0, color2: 1 },
  { model: 523, x: 638.8494, y: -611.7486, z: 15.907, angle: 1.7327, color1: 0, color2: 1 },
  { model: 523, x: 637.1846, y: -611.6885, z: 15.9056, angle: 357.5959, color1: 0, color2: 1 },
  { model: 523, x: 635.358, y: -611.6191, z: 15.9051, angle: 358.0877, color1: 0, color2: 1 },
  { model: 523, x: 633.6669, y: -611.5318, z: 15.9055, angle: 358.8655, color1: 0, color2: 1 },
];

export function spawnPoliceVehicles(): void {
  for (const spot of POLICE_VEHICLES) {
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
      siren: spot.model === 415,
      lightBar: spot.model === 415,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_POLICE_ID, DENY);
    }
  }
}
