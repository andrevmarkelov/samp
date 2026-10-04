import {
  INVALID_VEHICLE_ID,
  omp,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { getPool } from "../../shared/database";
import type { RowDataPacket } from "mysql2/promise";
import { STREET_WORLD } from "../spawn/point";
import {
  findOwnedPlayerVehicle,
  updatePlayerVehicleFuel,
  updatePlayerVehicleHealth,
  updatePlayerVehicleLock,
  type PlayerVehicleRecord,
} from "./player-vehicles";
import { clearVehicleFuel, getVehicleFuel, setVehicleFuel } from "./fuel";
import { createServerVehicle } from "./spawn";

const PERSONAL_RESPAWN_SEC = 999_999;
const ANIM_SYNC_ALL = 1;
const DOORS_LOCKED = 1;
const DOORS_UNLOCKED = 0;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
/** Радиус /lock рядом с машиной. */
export const PERSONAL_LOCK_RADIUS = 5;
/** Звук замка (25800) слышен в радиусе 10 м от машины. */
const LOCK_SOUND_ID = 25800;
const LOCK_SOUND_RADIUS = 10;

export type PersonalRuntime = {
  dbId: number;
  ownerId: number;
  locked: boolean;
  trunkMetal: number;
  trunkAmmo: number;
  trunkDrugs: number;
};

/** dbId → runtime vehicle id */
const runtimeByDbId = new Map<number, number>();
/** runtime vehicle id → meta */
const personalByRuntime = new Map<number, PersonalRuntime>();
/** Чтобы не спамить текст владельца при входе. */
const ownerHintShown = new Set<number>();

export function getPersonalRuntime(runtimeId: number): PersonalRuntime | null {
  return personalByRuntime.get(runtimeId) ?? null;
}

export function isPersonalVehicleLocked(vehicle: Vehicle): boolean | null {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    return null;
  }
  const personal = personalByRuntime.get(id);
  return personal ? personal.locked : null;
}

export function findRuntimeIdByDbId(dbId: number): number | undefined {
  return runtimeByDbId.get(dbId);
}

/** Обновить кэш багажника после успешной записи в БД. */
export function adjustPersonalTrunk(
  runtimeId: number,
  item: "ammo" | "metal" | "drugs",
  delta: number
): void {
  const personal = personalByRuntime.get(runtimeId);
  if (!personal) {
    return;
  }
  if (item === "ammo") {
    personal.trunkAmmo = Math.max(0, personal.trunkAmmo + delta);
  } else if (item === "metal") {
    personal.trunkMetal = Math.max(0, personal.trunkMetal + delta);
  } else {
    personal.trunkDrugs = Math.max(0, personal.trunkDrugs + delta);
  }
}

/** Сменить владельца в runtime после продажи игроку. */
export function setPersonalOwner(runtimeId: number, ownerId: number): void {
  const personal = personalByRuntime.get(runtimeId);
  if (!personal) {
    return;
  }
  personal.ownerId = ownerId;
}

/** Игрок в этом ТС или в радиусе от него. */
export function isPlayerNearPersonalVehicle(
  player: Player,
  runtimeId: number,
  radius = PERSONAL_LOCK_RADIUS
): boolean {
  try {
    if (player.isInAnyVehicle() && player.getVehicleID() === runtimeId) {
      return true;
    }
  } catch {
    // Не в машине.
  }

  const vehicle = omp.vehicles.at(runtimeId);
  if (!vehicle) {
    return false;
  }

  try {
    const pos = player.getPos();
    return vehicle.getDistanceFromPoint(pos.x, pos.y, pos.z) <= radius;
  } catch {
    return false;
  }
}

export function bindPersonalVehicles(): void {
  omp.on("vehicleStreamIn", (vehicle, player) => {
    applyPersonalDoorLock(vehicle, player);
  });

  omp.on("playerStateChange", (player, newState, oldState) => {
    if (newState === PLAYER_STATE_DRIVER || newState === PLAYER_STATE_PASSENGER) {
      handleEnterPersonal(player, newState === PLAYER_STATE_PASSENGER);
      return;
    }

    if (
      oldState === PLAYER_STATE_DRIVER &&
      newState !== PLAYER_STATE_DRIVER &&
      newState !== PLAYER_STATE_PASSENGER
    ) {
      const slotId = playerId(player);
      if (slotId !== null) {
        ownerHintShown.delete(slotId);
      }
      void saveDriverVehicleState(player);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      ownerHintShown.delete(slotId);
    }

    const account = getAccount(player);
    if (!account) {
      return;
    }

    void despawnOwnerVehiclesOnDisconnect(account.id);
  });
}

export function spawnPersonalVehicle(
  record: PlayerVehicleRecord,
  x: number,
  y: number,
  z: number,
  angle: number
): Vehicle | null {
  destroyPersonalVehicleByDbId(record.id, false);

  const vehicle = createServerVehicle({
    model: record.modelId,
    x,
    y,
    z,
    angle,
    color1: record.color1,
    color2: record.color2,
    respawnSec: PERSONAL_RESPAWN_SEC,
    world: STREET_WORLD,
  });
  if (!vehicle) {
    return null;
  }

  const runtimeId = liveVehicleId(vehicle);
  if (runtimeId === null) {
    return null;
  }

  try {
    vehicle.setHealth(Math.max(250, Math.min(1000, record.health)));
  } catch {
    // Игнор.
  }

  if (record.hasNitro) {
    try {
      vehicle.addComponent(1010);
    } catch {
      // Модель без нитро.
    }
  }

  runtimeByDbId.set(record.id, runtimeId);
  personalByRuntime.set(runtimeId, {
    dbId: record.id,
    ownerId: record.ownerId,
    locked: record.isLocked,
    trunkMetal: record.trunkMetal,
    trunkAmmo: record.trunkAmmo,
    trunkDrugs: record.trunkDrugs,
  });
  setVehicleFuel(vehicle, record.fuel);
  refreshPersonalDoorLocks(runtimeId);
  return vehicle;
}

/** Уничтожить runtime-машину. При saveState — сохранить HP в БД. */
export function destroyPersonalVehicleByDbId(dbId: number, saveState: boolean): void {
  const runtimeId = runtimeByDbId.get(dbId);
  if (runtimeId === undefined) {
    return;
  }

  const vehicle = omp.vehicles.at(runtimeId);
  if (saveState && vehicle) {
    try {
      void updatePlayerVehicleHealth(dbId, vehicle.getHealth());
      void updatePlayerVehicleFuel(dbId, getVehicleFuel(vehicle));
    } catch {
      // Уже уничтожена.
    }
  }

  runtimeByDbId.delete(dbId);
  personalByRuntime.delete(runtimeId);
  clearVehicleFuel(runtimeId);

  if (!vehicle) {
    return;
  }

  ejectOccupants(runtimeId);
  try {
    vehicle.destroy();
  } catch {
    // Уже уничтожена.
  }
}

export async function toggleNearbyPersonalLock(player: Player): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const vehicle = findOwnedPersonalVehicleNear(player, account.id);
  if (!vehicle) {
    player.sendClientMessage(
      Color.error,
      "Рядом нет вашего транспорта. Подойдите ближе или сядьте в него."
    );
    return;
  }

  const runtimeId = liveVehicleId(vehicle);
  if (runtimeId === null) {
    return;
  }

  const personal = personalByRuntime.get(runtimeId);
  if (!personal || personal.ownerId !== account.id) {
    return;
  }

  const nextLocked = !personal.locked;
  personal.locked = nextLocked;
  refreshPersonalDoorLocks(runtimeId);

  try {
    await updatePlayerVehicleLock(personal.dbId, nextLocked);
  } catch {
    personal.locked = !nextLocked;
    refreshPersonalDoorLocks(runtimeId);
    player.sendClientMessage(Color.error, "Не удалось сохранить статус замка.");
    return;
  }

  playLockSoundNearVehicle(vehicle);

  player.sendClientMessage(
    nextLocked ? Color.error : Color.tryOk,
    nextLocked ? "Транспорт закрыт." : "Транспорт открыт."
  );
}

function playLockSoundNearVehicle(vehicle: Vehicle): void {
  let x = 0;
  let y = 0;
  let z = 0;
  try {
    const pos = vehicle.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
  } catch {
    return;
  }

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      const pos = other.getPos();
      if (Math.hypot(pos.x - x, pos.y - y, pos.z - z) > LOCK_SOUND_RADIUS) {
        return;
      }
      other.playGameSound(LOCK_SOUND_ID, x, y, z);
    } catch {
      // Слот пустой.
    }
  });
}

/** Любой заспавненный личный ТС владельца (без проверки дистанции). */
export function findOwnedPersonalVehicle(ownerId: number): Vehicle | null {
  for (const [runtimeId, personal] of personalByRuntime) {
    if (personal.ownerId !== ownerId) {
      continue;
    }
    const vehicle = omp.vehicles.at(runtimeId);
    if (vehicle) {
      return vehicle;
    }
  }
  return null;
}

/** Найти личный ТС владельца: сначала в чём сидит, иначе ближайший в радиусе. */
export function findOwnedPersonalVehicleNear(
  player: Player,
  ownerId: number,
  radius = PERSONAL_LOCK_RADIUS
): Vehicle | null {
  try {
    if (player.isInAnyVehicle()) {
      const vehicle = omp.vehicles.at(player.getVehicleID());
      if (vehicle) {
        const id = liveVehicleId(vehicle);
        if (id !== null) {
          const personal = personalByRuntime.get(id);
          if (personal && personal.ownerId === ownerId) {
            return vehicle;
          }
        }
      }
    }
  } catch {
    // Не в машине.
  }

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
  let bestDist = radius;
  for (const [runtimeId, personal] of personalByRuntime) {
    if (personal.ownerId !== ownerId) {
      continue;
    }
    const vehicle = omp.vehicles.at(runtimeId);
    if (!vehicle) {
      continue;
    }
    try {
      const dist = vehicle.getDistanceFromPoint(x, y, z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = vehicle;
      }
    } catch {
      // Уничтожена.
    }
  }
  return best;
}

export async function parkPersonalVehicleAtHouse(
  player: Player,
  record: PlayerVehicleRecord,
  x: number,
  y: number,
  z: number,
  angle: number
): Promise<Vehicle | null> {
  const runtimeId = runtimeByDbId.get(record.id);
  if (runtimeId !== undefined) {
    const existing = omp.vehicles.at(runtimeId);
    if (existing) {
      try {
        const hp = existing.getHealth();
        const fuel = getVehicleFuel(existing);
        await updatePlayerVehicleHealth(record.id, hp);
        await updatePlayerVehicleFuel(record.id, fuel);
        record.health = hp;
        record.fuel = Math.round(fuel);
      } catch {
        // Игнор.
      }
    }
    destroyPersonalVehicleByDbId(record.id, false);
  }

  const fresh = await findOwnedPlayerVehicle(record.ownerId);
  const toSpawn = fresh ?? record;
  return spawnPersonalVehicle(toSpawn, x, y, z, angle);
}

async function despawnOwnerVehiclesOnDisconnect(ownerId: number): Promise<void> {
  const ownedDbIds: number[] = [];
  for (const [dbId, runtimeId] of runtimeByDbId) {
    const personal = personalByRuntime.get(runtimeId);
    if (personal && personal.ownerId === ownerId) {
      ownedDbIds.push(dbId);
    }
  }

  for (const dbId of ownedDbIds) {
    destroyPersonalVehicleByDbId(dbId, true);
  }
}

async function saveDriverVehicleState(player: Player): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  // После выхода getVehicleID уже пуст — ищем по owner в runtime и сохраняем HP
  // через последнее известное… На leave мы ещё можем не иметь vehicle.
  // Сохраняем все runtime машины владельца, в которых он был водителем — упрощённо
  // все его заспавненные авто.
  for (const [runtimeId, personal] of personalByRuntime) {
    if (personal.ownerId !== account.id) {
      continue;
    }
    const vehicle = omp.vehicles.at(runtimeId);
    if (!vehicle) {
      continue;
    }
    try {
      await updatePlayerVehicleHealth(personal.dbId, vehicle.getHealth());
      await updatePlayerVehicleFuel(personal.dbId, getVehicleFuel(vehicle));
    } catch {
      // Игнор.
    }
  }
}

function handleEnterPersonal(player: Player, asPassenger: boolean): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  let vehicle: Vehicle | null = null;
  try {
    vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return;
  }
  if (!vehicle) {
    return;
  }

  const runtimeId = liveVehicleId(vehicle);
  if (runtimeId === null) {
    return;
  }

  const personal = personalByRuntime.get(runtimeId);
  if (!personal) {
    return;
  }

  // Закрыта — никто, включая владельца.
  if (personal.locked) {
    player.sendClientMessage(Color.error, "Транспорт закрыт.");
    eject(player);
    return;
  }

  if (!asPassenger) {
    void notifyOwnerOnEnter(player, personal.ownerId);
  }
}

async function notifyOwnerOnEnter(player: Player, ownerId: number): Promise<void> {
  const slotId = playerId(player);
  if (slotId === null || ownerHintShown.has(slotId)) {
    return;
  }
  ownerHintShown.add(slotId);

  const tag = await resolveOwnerTag(ownerId);
  try {
    player.sendClientMessage(Color.info, `Транспорт принадлежит ${tag}.`);
  } catch {
    // Игрок вышел.
  }
}

async function resolveOwnerTag(ownerId: number): Promise<string> {
  let online: Player | null = null;
  omp.players.forEach((other) => {
    if (online || !isPlayerActive(other) || !isAuthenticated(other)) {
      return;
    }
    const account = getAccount(other);
    if (account && account.id === ownerId) {
      online = other;
    }
  });

  if (online) {
    return playerChatName(online);
  }

  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT name FROM users WHERE id = ? LIMIT 1",
      [ownerId]
    );
    const name = String(rows[0]?.name ?? "").trim();
    return name || "Неизвестный";
  } catch {
    return "Неизвестный";
  }
}

function applyPersonalDoorLock(vehicle: Vehicle, player: Player): void {
  const runtimeId = liveVehicleId(vehicle);
  if (runtimeId === null) {
    return;
  }

  const personal = personalByRuntime.get(runtimeId);
  if (!personal) {
    return;
  }

  // Закрыта → двери закрыты для всех; открыта → для всех.
  try {
    vehicle.setParamsForPlayer(
      player,
      0,
      personal.locked ? DOORS_LOCKED : DOORS_UNLOCKED
    );
  } catch {
    // Слот пустой.
  }
}

function refreshPersonalDoorLocks(runtimeId: number): void {
  const vehicle = omp.vehicles.at(runtimeId);
  if (!vehicle) {
    return;
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player)) {
      return;
    }
    applyPersonalDoorLock(vehicle, player);
  });
}

function ejectOccupants(vehicleId: number): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player)) {
      return;
    }
    try {
      if (!player.isInAnyVehicle() || player.getVehicleID() !== vehicleId) {
        return;
      }
      eject(player);
    } catch {
      // Слот пустой.
    }
  });
}

function eject(player: Player): void {
  try {
    player.clearAnimations(ANIM_SYNC_ALL);
    player.removeFromVehicle();
  } catch {
    // Уже не в транспорте.
  }
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    if (id === null || id === INVALID_VEHICLE_ID || id < 1) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}
