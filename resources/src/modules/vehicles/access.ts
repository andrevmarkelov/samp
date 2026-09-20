import { INVALID_VEHICLE_ID, omp, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import { getMembership, ORG_AUTOSCHOOL_ID } from "../org";
import {
  autoschoolExamVehicleDeny,
  canEnterAutoschoolExamVehicle,
} from "../autoschool/session";
import { driveLicenseDeny } from "./drive-license";

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const ANIM_SYNC_ALL = 1;
const DOORS_LOCKED = 1;
const DOORS_UNLOCKED = 0;
const DENY_COOLDOWN_MS = 2500;
/** F / Enter. KEY_SECONDARY_ATTACK = 16. */
const KEY_ENTER_VEHICLE = 16;
const ENTER_RANGE = 5;
const DEFAULT_DENY = "Vy ne mozhete sidet' v etom transporte.";

type OrgVehicleAccess = {
  orgIds: readonly number[];
  denyMessage: string;
  ptr: number | null;
};

const byVehicleId = new Map<number, OrgVehicleAccess>();
const denyAt = new Map<number, number>();

export function registerOrgVehicle(
  vehicle: Vehicle,
  orgId: number | readonly number[],
  denyMessage?: string,
  retried = false
): void {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    if (!retried) {
      setTimeout(() => {
        registerOrgVehicle(vehicle, orgId, denyMessage, true);
      }, 0);
    }
    return;
  }

  const orgIds = typeof orgId === "number" ? [orgId] : [...orgId];
  byVehicleId.set(id, {
    orgIds,
    denyMessage: denyMessage?.trim() || DEFAULT_DENY,
    ptr: vehiclePtr(vehicle),
  });
}

export function unregisterOrgVehicle(vehicle: Vehicle): void {
  const id = liveVehicleId(vehicle);
  if (id !== null) {
    byVehicleId.delete(id);
  }
}

export function bindOrgVehicleAccess(): void {
  omp.on("vehicleStreamIn", (vehicle, player) => {
    applyDoorLock(vehicle, player);
  });

  omp.on("playerEnterVehicle", (player, vehicle, passenger) => {
    refuseIfForbidden(player, vehicle, true, Boolean(passenger));
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_ENTER_VEHICLE) === 0) {
      return;
    }

    denyNearbyIfForbidden(player);
  });

  omp.on("playerStateChange", (player, newState) => {
    if (newState !== PLAYER_STATE_DRIVER && newState !== PLAYER_STATE_PASSENGER) {
      return;
    }

    try {
      const vehicle = omp.vehicles.at(player.getVehicleID());
      if (!vehicle) {
        return;
      }

      refuseIfForbidden(
        player,
        vehicle,
        false,
        newState === PLAYER_STATE_PASSENGER
      );
    } catch {
      // Слот пустой.
    }
  });
}

export function syncOrgVehicleAccess(player: Player): void {
  ejectFromForbiddenOrgVehicle(player);
  for (const [id] of byVehicleId) {
    const vehicle = omp.vehicles.at(id);
    if (!vehicle) {
      continue;
    }

    applyDoorLock(vehicle, player);
  }
}

function ejectFromForbiddenOrgVehicle(player: Player): void {
  try {
    if (!player.isInAnyVehicle()) {
      return;
    }

    const vehicle = omp.vehicles.at(player.getVehicleID());
    if (!vehicle) {
      return;
    }

    refuseIfForbidden(
      player,
      vehicle,
      false,
      player.getState() === PLAYER_STATE_PASSENGER
    );
  } catch {
    // Слот пустой.
  }
}

function denyNearbyIfForbidden(player: Player): void {
  try {
    if (!isPlayerActive(player) || player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }

    if (player.isInAnyVehicle()) {
      return;
    }
  } catch {
    return;
  }

  const vehicle = nearestVehicle(player, ENTER_RANGE);
  if (!vehicle) {
    return;
  }

  const access = accessFor(vehicle);
  if (access && !canUseOrgVehicle(player, access.orgIds, vehicle)) {
    deny(player, denyMessage(player, vehicle, access));
    return;
  }

  if (skipsDriveLicense(player, vehicle, access)) {
    return;
  }

  const licenseMsg = driveLicenseDeny(player, vehicle);
  if (licenseMsg) {
    deny(player, licenseMsg);
  }
}

function nearestVehicle(player: Player, range: number): Vehicle | null {
  let x = 0;
  let y = 0;
  let z = 0;
  try {
    const pos = player.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
  } catch {
    return null;
  }

  let best: Vehicle | null = null;
  let bestDist = range;
  for (const vehicle of omp.vehicles.all()) {
    try {
      const dist = vehicle.getDistanceFromPoint(x, y, z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = vehicle;
      }
    } catch {
      // Транспорт уже уничтожен.
    }
  }

  return best;
}

function refuseIfForbidden(
  player: Player,
  vehicle: Vehicle,
  entering: boolean,
  passenger: boolean
): boolean {
  const access = accessFor(vehicle);
  if (access && !canUseOrgVehicle(player, access.orgIds, vehicle)) {
    deny(player, denyMessage(player, vehicle, access));
    eject(player, entering);
    return true;
  }

  if (!passenger && !skipsDriveLicense(player, vehicle, access)) {
    const licenseMsg = driveLicenseDeny(player, vehicle);
    if (licenseMsg) {
      deny(player, licenseMsg);
      eject(player, entering);
      return true;
    }
  }

  return false;
}

function eject(player: Player, entering: boolean): void {
  try {
    if (entering) {
      player.clearAnimations(ANIM_SYNC_ALL);
    }
    player.removeFromVehicle();
  } catch {
    // Уже не в транспорте.
  }
}

function applyDoorLock(vehicle: Vehicle, player: Player): void {
  const access = accessFor(vehicle);
  if (!access) {
    return;
  }

  try {
    const locked = canUseOrgVehicle(player, access.orgIds, vehicle)
      ? DOORS_UNLOCKED
      : DOORS_LOCKED;
    vehicle.setParamsForPlayer(player, 0, locked);
  } catch {
    // Слот или транспорт уже не в мире.
  }
}

function skipsDriveLicense(
  player: Player,
  vehicle: Vehicle,
  access: OrgVehicleAccess | null
): boolean {
  return (
    !!access &&
    access.orgIds.includes(ORG_AUTOSCHOOL_ID) &&
    canEnterAutoschoolExamVehicle(player, vehicle)
  );
}

function canUseOrgVehicle(
  player: Player,
  orgIds: readonly number[],
  vehicle: Vehicle
): boolean {
  if (!isPlayerActive(player)) {
    return false;
  }

  const account = getAccount(player);
  if (!account) {
    return false;
  }

  const orgId = getMembership(account)?.org.id;
  if (orgId !== undefined && orgIds.includes(orgId)) {
    return true;
  }

  return (
    orgIds.includes(ORG_AUTOSCHOOL_ID) && canEnterAutoschoolExamVehicle(player, vehicle)
  );
}

function denyMessage(
  player: Player,
  vehicle: Vehicle,
  access: OrgVehicleAccess
): string {
  if (access.orgIds.includes(ORG_AUTOSCHOOL_ID)) {
    return autoschoolExamVehicleDeny(player, vehicle) ?? access.denyMessage;
  }

  return access.denyMessage;
}

function accessFor(vehicle: Vehicle): OrgVehicleAccess | null {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return null;
  }

  const access = byVehicleId.get(id);
  if (!access) {
    return null;
  }

  const ptr = vehiclePtr(vehicle);
  if (ptr === null || access.ptr !== ptr) {
    byVehicleId.delete(id);
    return null;
  }

  return access;
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    if (id === null || id === undefined || id === INVALID_VEHICLE_ID) {
      return null;
    }

    const numeric = Number(id);
    return Number.isInteger(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function vehiclePtr(vehicle: Vehicle): number | null {
  try {
    const ptr = vehicle.getPtr();
    return ptr === null || ptr === undefined ? null : ptr;
  } catch {
    return null;
  }
}

function deny(player: Player, message: string): void {
  const id = playerId(player);
  if (id !== null) {
    const now = Date.now();
    if ((denyAt.get(id) ?? 0) + DENY_COOLDOWN_MS > now) {
      return;
    }
    denyAt.set(id, now);
  }

  try {
    player.sendClientMessage(Color.error, message);
  } catch {
    // Слот пустой.
  }
}
