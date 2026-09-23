import { omp, type Player, type Vehicle } from "@omp-node/core";
import { playerId } from "../../../shared/player";
import { AcCode, PLAYER_STATE } from "../codes";
import { isCodeEnabled } from "../config";
import { dist3, nowMs, speedFromVelocity } from "../math";
import { reportCheat } from "../punish";
import { ensureVehicleState, getPlayerState } from "../state";

export function onEnterVehicle(player: Player, vehicle: Vehicle, isPassenger: boolean): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state) return;

  let vid = 0;
  try {
    vid = Number(vehicle.getID());
  } catch {
    return;
  }

  const now = nowMs();
  if (now >= state.vehicleTrustedUntil && isCodeEnabled(AcCode.TeleportVehEnter)) {
    try {
      const vpos = vehicle.getPos();
      const dist = dist3(state.x, state.y, state.z, vpos.x, vpos.y, vpos.z);
      if (dist > 25) {
        reportCheat(player, AcCode.TeleportVehEnter, `d=${dist.toFixed(1)}`);
        return;
      }
    } catch {
      // ignore
    }
  }

  state.vehicleId = vid;
  state.seat = isPassenger ? 1 : 0;
  state.vehicleTrustedUntil = now + 1500;

  const vState = ensureVehicleState(vid);
  if (!isPassenger) vState.driverId = id;
  try {
    vState.health = vehicle.getHealth();
  } catch {
    // ignore
  }
}

export function onStateChange(player: Player, newState: number, _oldState: number): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state) return;

  if (
    newState !== PLAYER_STATE.driver &&
    newState !== PLAYER_STATE.passenger
  ) {
    state.vehicleId = 0;
    state.seat = -1;
  }
}

export function checkVehicleHealth(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned) return;
  if (!isCodeEnabled(AcCode.HealthVeh)) return;

  let pState: number;
  let vid: number;
  try {
    pState = player.getState();
    vid = player.getVehicleID();
  } catch {
    return;
  }
  if (pState !== PLAYER_STATE.driver || vid <= 0) return;

  try {
    const vehicle = omp.vehicles.at(vid);
    if (!vehicle) return;
    const hp = vehicle.getHealth();
    const vState = ensureVehicleState(vid);
    const vel = vehicle.getVelocity();
    vState.speed = speedFromVelocity(vel.x, vel.y, vel.z);
    const pos = vehicle.getPos();
    vState.x = pos.x;
    vState.y = pos.y;
    vState.z = pos.z;

    if (hp > vState.health + 5 && vState.health > 0) {
      reportCheat(player, AcCode.HealthVeh, `hp=${hp.toFixed(0)} exp=${vState.health.toFixed(0)}`);
      return;
    }
    if (hp > 0) vState.health = Math.min(vState.health, hp);
  } catch {
    // ignore
  }
}

export function trustVehicleHealth(vehicleId: number, health: number): void {
  const vState = ensureVehicleState(vehicleId);
  vState.health = health;
}

export function onVehicleMod(player: Player, _vehicle: Vehicle, componentId: number): void {
  if (!isCodeEnabled(AcCode.TuningCrasher)) return;
  if (componentId < 1000 || componentId > 1193) {
    reportCheat(player, AcCode.TuningCrasher, `comp=${componentId}`);
  }
}
