import { STREET_WORLD } from "../spawn/point";
import { ORG_ARMY_ID } from "../org";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

const RESPAWN_SEC = 100;
const RANDOM_COLOR = -1;
const ARMY_CAR_COLOR = 173;
const COLORED_MODELS = new Set([431, 445, 500]);
const DENY = "Вы не состоите в армии.";

const ARMY_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
}> = [
  { model: 425, x: 2781.2402, y: -2351.428, z: 14.347, angle: 90 },
  { model: 470, x: 2795.6365, y: -2504.0559, z: 13.4056, angle: 90 },
  { model: 500, x: 2766.7952, y: -2386.6545, z: 13.6421, angle: 90 },
  { model: 431, x: 2782.6165, y: -2440.3896, z: 13.6429, angle: 90 },
  { model: 433, x: 2792.698, y: -2456.0576, z: 14.0537, angle: 90 },
  { model: 445, x: 2773.3018, y: -2511.6458, z: 13.468, angle: 0 },
  { model: 430, x: 2767.5686, y: -2583.9229, z: 0.691, angle: 90 },
  { model: 470, x: 2795.6365, y: -2500.0022, z: 13.4056, angle: 90 },
  { model: 470, x: 2795.6365, y: -2495.9214, z: 13.4056, angle: 90 },
  { model: 470, x: 2795.6365, y: -2491.7131, z: 13.4056, angle: 90 },
  { model: 470, x: 2795.6365, y: -2487.3821, z: 13.4056, angle: 90 },
  { model: 470, x: 2787.9827, y: -2487.3821, z: 13.4056, angle: 90 },
  { model: 470, x: 2787.9827, y: -2504.0559, z: 13.4056, angle: 90 },
  { model: 470, x: 2787.9827, y: -2500.0022, z: 13.4056, angle: 90 },
  { model: 470, x: 2787.9827, y: -2495.9214, z: 13.4056, angle: 90 },
  { model: 470, x: 2787.9827, y: -2491.7131, z: 13.4056, angle: 90 },
  { model: 433, x: 2779.4565, y: -2417.5681, z: 14.0537, angle: 90 },
  { model: 433, x: 2779.4565, y: -2456.0576, z: 14.0537, angle: 90 },
  { model: 433, x: 2792.698, y: -2417.5681, z: 14.0537, angle: 90 },
  { model: 430, x: 2750.6685, y: -2583.9229, z: 0.691, angle: 90 },
  { model: 430, x: 2731.9878, y: -2583.9229, z: 0.691, angle: 90 },
  { model: 445, x: 2769.2544, y: -2511.6458, z: 13.468, angle: 0 },
  { model: 500, x: 2766.7952, y: -2389.6785, z: 13.6421, angle: 90 },
  { model: 500, x: 2766.7952, y: -2383.7197, z: 13.6421, angle: 90 },
  { model: 548, x: 2793.8582, y: -2540.5591, z: 15.3947, angle: 0 },
];

export function spawnArmyVehicles(): void {
  for (const spot of ARMY_VEHICLES) {
    const color = COLORED_MODELS.has(spot.model) ? ARMY_CAR_COLOR : RANDOM_COLOR;
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: color,
      color2: color,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_ARMY_ID, DENY);
    }
  }
}
