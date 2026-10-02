import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import { STREET_WORLD } from "../spawn/point";
import type { GameModule } from "../types";
import { bindOrgVehicleAccess } from "./access";
import { spawnArmyVehicles } from "./army";
import { spawnAutoschoolVehicles } from "./autoschool";
import { spawnFbiVehicles } from "./fbi";
import { spawnGangVehicles } from "./gangs";
import { spawnMafiaVehicles } from "./mafias";
import { spawnHospitalVehicles } from "./hospital";
import { spawnMeriyaVehicles } from "./meriya";
import { spawnLspdVehicles } from "./lspd";
import { spawnPoliceVehicles } from "./police";
import { spawnPrisonVehicles } from "./prison";
import { spawnRadioVehicles } from "./radio";
import { ensurePlayerVehiclesTable } from "./player-vehicles";
import { startDealerships } from "./dealership";
import { bindPersonalVehicles } from "./personal";
import { bindPersonalVehicleCommands } from "./commands";
import { spawnRentalVehicles } from "./rental";
import { startSpeedLimiter } from "./limit";
import { bindLightBarRespawn } from "./light-bar";
import { createServerVehicle, startEngineControl } from "./spawn";

export {
  DEFAULT_BUY_COLOR,
  DEFAULT_VEHICLE_FUEL,
  DEFAULT_VEHICLE_HEALTH,
  MAX_TRUNK_AMMO,
  MAX_TRUNK_DRUGS,
  MAX_TRUNK_METAL,
  STATE_SELL_REFUND_RATE,
  countPlayerVehicles,
  ensurePlayerVehiclesTable,
  findOwnedPlayerVehicle,
  getPlayerVehicle,
  listPlayerVehicles,
  purchasePlayerVehicle,
  updatePlayerVehicleHealth,
  updatePlayerVehicleLock,
  addPlayerVehicleTrunk,
  takePlayerVehicleTrunk,
  deletePlayerVehicle,
  sellPlayerVehicleToState,
  stateSellRefund,
  transferPlayerVehicleSale,
} from "./player-vehicles";
export type {
  PlayerVehicleRecord,
  PurchasePlayerVehicleResult,
  TrunkItem,
} from "./player-vehicles";
export { spawnPersonalVehicle, bindPersonalVehicles } from "./personal";
export { startDealerships } from "./dealership";
export { bindPersonalVehicleCommands } from "./commands";
export { bindPersonalTrunk } from "./trunk";
export {
  TRUNK_MENU_DIALOG_ID,
  TRUNK_AMOUNT_DIALOG_ID,
} from "./trunk";
export { bindPersonalVehicleSell } from "./sell";
export {
  CAR_SELL_STATE_DIALOG_ID,
  CAR_SELL_PLAYER_INPUT_DIALOG_ID,
  CAR_SELL_PLAYER_CONFIRM_DIALOG_ID,
} from "./sell";

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
  async start() {
    if (isDatabaseReady()) {
      try {
        await ensurePlayerVehiclesTable();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] player_vehicles: ошибка — ${message}`);
      }
    }

    startEngineControl();
    bindLightBarRespawn();
    startSpeedLimiter();
    bindOrgVehicleAccess();
    spawnArmyVehicles();
    spawnHospitalVehicles();
    spawnMeriyaVehicles();
    spawnPoliceVehicles();
    spawnLspdVehicles();
    spawnFbiVehicles();
    spawnAutoschoolVehicles();
    spawnRadioVehicles();
    spawnPrisonVehicles();
    spawnGangVehicles();
    spawnMafiaVehicles();
    spawnRentalVehicles();
    bindPersonalVehicles();
    bindPersonalVehicleCommands();
    startDealerships();

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
