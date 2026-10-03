import { omp, type Player, type Vehicle } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import {
  getVehicleFuel,
  MAX_VEHICLE_FUEL,
  setExtraEngineBlocker,
  setVehicleFuel,
  vehicleUsesFuel,
} from "../vehicles/fuel";
import { getPersonalRuntime } from "../vehicles/personal";
import { updatePlayerVehicleFuel } from "../vehicles/player-vehicles";
import { setVehicleEngine } from "../vehicles/spawn";
import {
  getBusiness,
  listBusinesses,
  payBusinessCashShare,
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { isGasStationType } from "./types";

/** Сигнал в ТС / C пешком (KEY_CROUCH). */
const KEY_CROUCH = 2;
const PLAYER_STATE_DRIVER = 2;
const PICKUP_RADIUS = 5.5;
const BIZ_SHARE = 0.8;
/** $ за единицу топлива (полный бак с 0 = $1000). */
const PRICE_PER_UNIT = 10;
const REFUEL_MS = 6000;

const refueling = new Set<number>();

export function startGasStations(): void {
  setExtraEngineBlocker((player) => {
    const slot = playerId(player);
    if (slot !== null && refueling.has(slot)) {
      return "Идёт заправка. Подождите.";
    }
    return null;
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_CROUCH) === 0) {
      return;
    }

    void tryRefuel(player);
  });

  omp.on("playerDeath", (player) => {
    abortRefuel(player);
  });

  omp.on("playerStateChange", (player, newState) => {
    if (newState !== PLAYER_STATE_DRIVER) {
      abortRefuel(player);
    }
  });

  omp.on("playerDisconnect", (player) => {
    abortRefuel(player);
  });

  const count = listBusinesses().filter((b) => isGasStationType(b.typeId)).length;
  omp.log(`[${SERVER_TAG}] АЗС: станций ${count}`);
}

function abortRefuel(player: Player): void {
  const slot = playerId(player);
  if (slot === null || !refueling.has(slot)) {
    return;
  }

  refueling.delete(slot);
  setControllable(player, true);
}

async function tryRefuel(player: Player): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return;
  }

  if (refueling.has(slot)) {
    return;
  }

  let vehicle: Vehicle | null = null;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return;
    }

    if (
      player.getVirtualWorld() !== STREET_WORLD ||
      player.getInterior() !== 0
    ) {
      return;
    }

    vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return;
  }

  if (!vehicle) {
    return;
  }

  let model = 0;
  let vehicleId = -1;
  try {
    model = vehicle.getModel();
    vehicleId = Number(vehicle.getID());
  } catch {
    return;
  }

  if (!Number.isInteger(vehicleId) || vehicleId < 0) {
    return;
  }

  if (!vehicleUsesFuel(model)) {
    return;
  }

  const station = nearestGasStation(player, vehicle);
  if (!station) {
    return;
  }

  const fuel = getVehicleFuel(vehicle);
  if (fuel >= MAX_VEHICLE_FUEL - 0.05) {
    player.sendClientMessage(Color.error, "Бак уже полный.");
    return;
  }

  const missing = Math.max(1, Math.ceil(MAX_VEHICLE_FUEL - fuel));
  const price = missing * PRICE_PER_UNIT;
  if (account.money < price) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(price)}.`
    );
    return;
  }

  refueling.add(slot);
  setVehicleEngine(vehicle, false, false);
  setControllable(player, false);
  player.sendClientMessage(
    Color.info,
    `Заправка… ${formatMoney(price)} (${missing} л). Подождите.`
  );

  await sleep(REFUEL_MS);

  // Смерть / выход / смена ТС сняли флаг — не оплачиваем.
  if (!refueling.has(slot)) {
    return;
  }

  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    abortRefuel(player);
    return;
  }

  const liveAccount = getAccount(player);
  if (!liveAccount || liveAccount.id !== account.id) {
    abortRefuel(player);
    return;
  }

  let liveVehicle: Vehicle | null = null;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      abortRefuel(player);
      player.sendClientMessage(Color.error, "Заправка отменена.");
      return;
    }

    liveVehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
    if (!liveVehicle || Number(liveVehicle.getID()) !== vehicleId) {
      abortRefuel(player);
      player.sendClientMessage(Color.error, "Заправка отменена.");
      return;
    }

    if (nearestGasStation(player, liveVehicle)?.id !== station.id) {
      abortRefuel(player);
      player.sendClientMessage(Color.error, "Заправка отменена: вы уехали от колонки.");
      return;
    }
  } catch {
    abortRefuel(player);
    player.sendClientMessage(Color.error, "Заправка отменена.");
    return;
  }

  let result;
  try {
    result = await payBusinessCashShare(
      station.id,
      liveAccount.id,
      price,
      BIZ_SHARE
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] АЗС biz=${station.id}: ${message}`);
    abortRefuel(player);
    player.sendClientMessage(Color.error, "Оплата не прошла. Попробуйте ещё раз.");
    return;
  }

  if (!refueling.has(slot)) {
    return;
  }

  if (!result.ok) {
    abortRefuel(player);
    if (result.reason === "funds") {
      player.sendClientMessage(
        Color.error,
        `Недостаточно наличных. Нужно ${formatMoney(price)}.`
      );
    } else {
      player.sendClientMessage(Color.error, "Оплата не прошла. Попробуйте ещё раз.");
    }
    return;
  }

  setBusinessBalance(station.id, result.balance);
  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  setVehicleFuel(liveVehicle, MAX_VEHICLE_FUEL);

  const personal = getPersonalRuntime(vehicleId);
  if (personal) {
    void updatePlayerVehicleFuel(personal.dbId, MAX_VEHICLE_FUEL).catch(() => {
      // Кэш уже полный.
    });
  }

  refueling.delete(slot);
  setControllable(player, true);
  setVehicleEngine(liveVehicle, true, true);

  player.sendClientMessage(
    Color.tryOk,
    `Бак заправлен до ${MAX_VEHICLE_FUEL}. Оплачено ${formatMoney(price)}.`
  );
}

function nearestGasStation(
  player: Player,
  vehicle: Vehicle
): BusinessRecord | null {
  let best: BusinessRecord | null = null;
  let bestDist = PICKUP_RADIUS;

  let x: number;
  let y: number;
  let z: number;
  try {
    const pos = vehicle.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
  } catch {
    try {
      const pos = player.getPos();
      x = pos.x;
      y = pos.y;
      z = pos.z;
    } catch {
      return null;
    }
  }

  for (const business of listBusinesses()) {
    if (!isGasStationType(business.typeId)) {
      continue;
    }

    const dist = Math.hypot(
      x - business.entranceX,
      y - business.entranceY,
      z - business.entranceZ
    );
    if (dist <= bestDist) {
      bestDist = dist;
      best = business;
    }
  }

  return best ? getBusiness(best.id) ?? best : null;
}

function setControllable(player: Player, enabled: boolean): void {
  try {
    player.toggleControllable(enabled);
  } catch {
    // Слот пуст.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
