import { STREET_WORLD } from "../spawn/point";
import { ORG_LCN_ID, ORG_RUSSIAN_MAFIA_ID, ORG_YAKUZA_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;

type MafiaCar = {
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
};

const YAKUZA_CARS: readonly MafiaCar[] = [
  { model: 409, x: 659.9299, y: -1282.1138, z: 13.343, angle: 180.2469, color1: 6, color2: 6 },
  { model: 487, x: 729.698, y: -1261.0846, z: 13.7308, angle: 89.8037, color1: 6, color2: 6 },
  { model: 579, x: 659.7813, y: -1272.7589, z: 13.4727, angle: 180.5027, color1: 6, color2: 6 },
  { model: 579, x: 659.7154, y: -1264.8335, z: 13.4771, angle: 180.6569, color1: 6, color2: 6 },
  { model: 560, x: 688.8492, y: -1233.6763, z: 15.776, angle: 121.5796, color1: 6, color2: 6 },
  { model: 560, x: 694.8387, y: -1230.2023, z: 16.2286, angle: 120.6975, color1: 6, color2: 6 },
  { model: 560, x: 700.7747, y: -1226.7637, z: 16.6491, angle: 120.4527, color1: 6, color2: 6 },
  { model: 560, x: 706.916, y: -1222.979, z: 17.0759, angle: 121.0829, color1: 6, color2: 6 },
  { model: 521, x: 709.5856, y: -1249.6611, z: 13.1339, angle: 358.3416, color1: 6, color2: 6 },
  { model: 521, x: 707.915, y: -1249.7146, z: 13.1262, angle: 2.1094, color1: 6, color2: 6 },
  { model: 521, x: 706.1029, y: -1249.7158, z: 13.1262, angle: 0.4443, color1: 6, color2: 6 },
  { model: 521, x: 704.2571, y: -1249.7062, z: 13.126, angle: 2.741, color1: 6, color2: 6 },
];

const LCN_CARS: readonly MafiaCar[] = [
  { model: 487, x: 1196.1023, y: -2015.9504, z: 69.2578, angle: 180.2632, color1: 145, color2: 145 },
  { model: 579, x: 1276.542, y: -2044.0574, z: 58.976, angle: 89.7628, color1: 145, color2: 145 },
  { model: 579, x: 1276.5176, y: -2040.119, z: 58.9596, angle: 90.246, color1: 145, color2: 145 },
  { model: 579, x: 1276.4768, y: -2035.7961, z: 58.9465, angle: 88.9762, color1: 145, color2: 145 },
  { model: 579, x: 1276.4662, y: -2031.6531, z: 58.9286, angle: 90.0995, color1: 145, color2: 145 },
  { model: 560, x: 1276.7181, y: -2027.436, z: 58.6815, angle: 89.9756, color1: 145, color2: 145 },
  { model: 560, x: 1276.7493, y: -2023.4993, z: 58.6655, angle: 90.428, color1: 145, color2: 145 },
  { model: 560, x: 1276.7385, y: -2019.9063, z: 58.657, angle: 89.7823, color1: 145, color2: 145 },
  { model: 560, x: 1276.7488, y: -2016.2833, z: 58.6516, angle: 88.8456, color1: 145, color2: 145 },
  { model: 409, x: 1247.2936, y: -2052.8628, z: 59.5919, angle: 268.7179, color1: 145, color2: 145 },
  { model: 521, x: 1245.7861, y: -2009.3247, z: 59.3965, angle: 181.6773, color1: 145, color2: 145 },
  { model: 521, x: 1247.4956, y: -2009.3815, z: 59.3464, angle: 180.1814, color1: 145, color2: 145 },
  { model: 521, x: 1249.1952, y: -2009.3813, z: 59.2998, angle: 180.3291, color1: 145, color2: 145 },
  { model: 521, x: 1250.9386, y: -2009.444, z: 59.2488, angle: 181.8325, color1: 145, color2: 145 },
  { model: 521, x: 1252.8303, y: -2009.4767, z: 59.1939, angle: 178.1289, color1: 145, color2: 145 },
];

const RUSSIAN_MAFIA_CARS: readonly MafiaCar[] = [
  { model: 521, x: 976.6413, y: -925.4323, z: 45.336, angle: 5.2451, color1: 0, color2: 0 },
  { model: 521, x: 974.6225, y: -925.5217, z: 45.3359, angle: 4.5657, color1: 0, color2: 0 },
  { model: 521, x: 972.7141, y: -925.5982, z: 45.3345, angle: 3.6894, color1: 0, color2: 0 },
  { model: 521, x: 970.601, y: -925.671, z: 45.3354, angle: 4.8265, color1: 0, color2: 0 },
  { model: 521, x: 968.442, y: -925.772, z: 45.3346, angle: 3.8246, color1: 0, color2: 0 },
  { model: 521, x: 966.467, y: -925.8014, z: 45.3346, angle: 4.6748, color1: 0, color2: 0 },
  { model: 560, x: 974.4943, y: -930.7044, z: 42.2142, angle: 92.2832, color1: 0, color2: 0 },
  { model: 560, x: 974.4825, y: -934.0621, z: 41.8311, angle: 89.5303, color1: 0, color2: 0 },
  { model: 560, x: 974.2296, y: -937.1943, z: 41.4667, angle: 87.9781, color1: 0, color2: 0 },
  { model: 560, x: 974.0164, y: -940.345, z: 41.0331, angle: 87.3172, color1: 0, color2: 0 },
  { model: 487, x: 918.1873, y: -933.4467, z: 42.7956, angle: 94.2227, color1: 0, color2: 0 },
  { model: 579, x: 894.3598, y: -923.1293, z: 42.2082, angle: 201.5826, color1: 0, color2: 0 },
  { model: 579, x: 890.4415, y: -924.7072, z: 42.0878, angle: 203.1853, color1: 0, color2: 0 },
  { model: 579, x: 886.5435, y: -926.4897, z: 42.077, angle: 204.1331, color1: 0, color2: 0 },
  { model: 579, x: 882.8876, y: -928.5485, z: 42.0641, angle: 210.8897, color1: 0, color2: 0 },
  { model: 579, x: 879.4825, y: -930.7388, z: 42.2693, angle: 212.8267, color1: 0, color2: 0 },
  { model: 409, x: 894.2687, y: -939.9675, z: 41.8998, angle: 90.5715, color1: 0, color2: 0 },
];

function spawnFleet(orgId: number, deny: string, cars: readonly MafiaCar[]): void {
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

export function spawnMafiaVehicles(): void {
  spawnFleet(ORG_YAKUZA_ID, "Vy ne sostoite v Yakuza.", YAKUZA_CARS);
  spawnFleet(ORG_LCN_ID, "Vy ne sostoite v La Cosa Nostra.", LCN_CARS);
  spawnFleet(ORG_RUSSIAN_MAFIA_ID, "Vy ne sostoite v Russkoy mafii.", RUSSIAN_MAFIA_CARS);
}
