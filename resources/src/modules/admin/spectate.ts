import { omp, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { markSpectating } from "../anticheat/trust";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { placeAt, type SpawnPoint } from "../spawn/point";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 1;
/** SPECTATE_MODE_NORMAL — третье лицо. */
const SPECTATE_MODE_NORMAL = 1;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;
const SYNC_MS = 400;
const RETURN_FALLBACK_MS = 80;

type SpecSession = {
  targetSlot: number;
  returnPoint: SpawnPoint;
  lastInterior: number;
  lastWorld: number;
  lastVehicleId: number;
};

/** adminSlot → сессия слежки. */
const sessions = new Map<number, SpecSession>();
/** После toggleSpectating(false) → вернуть на точку в playerSpawn. */
const pendingReturn = new Map<number, SpawnPoint>();

/** Слот цели слежки или null. */
export function getAdminSpectateTarget(player: Player): number | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  return sessions.get(id)?.targetSlot ?? null;
}

export function bindAdminSpectate(): void {
  registerCommand(
    "sp",
    "Слежка за игроком",
    (player, args) => {
      tryStartSpectate(player, args.trim());
    },
    true
  );

  registerCommand(
    "spoff",
    "Выйти из слежки",
    (player) => {
      tryStopSpectate(player);
    },
    true
  );

  setInterval(syncSpectateSessions, SYNC_MS);

  omp.on("playerSpawn", (player) => {
    applyPendingReturn(player);
  });

  omp.on("playerDeath", (player) => {
    // Смерть в спеке — без возврата на старую точку (спавн/больница сами).
    clearSpectateState(player, false);
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    clearSpectateState(player, false);

    for (const [adminSlot, session] of sessions) {
      if (session.targetSlot !== slot) {
        continue;
      }

      const admin = omp.players.at(adminSlot);
      if (admin && isPlayerActive(admin)) {
        stopSpectate(admin, "Игрок вышел из игры. Слежка прекращена.");
      } else {
        sessions.delete(adminSlot);
        pendingReturn.delete(adminSlot);
      }
    }
  });
}

function tryStartSpectate(player: Player, raw: string): void {
  if (!hasAdminAccess(player, MIN_LEVEL)) {
    return;
  }

  if (!raw) {
    player.sendClientMessage(Color.error, "Использование: /sp [id]");
    return;
  }

  const targetSlot = Number(raw);
  if (!Number.isInteger(targetSlot) || targetSlot < 0) {
    player.sendClientMessage(Color.error, "Использование: /sp [id]");
    return;
  }

  const target = findTarget(targetSlot);
  if (!target || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  const adminSlot = playerId(player);
  if (adminSlot === null) {
    return;
  }

  if (adminSlot === targetSlot) {
    player.sendClientMessage(Color.error, "Нельзя следить за самим собой.");
    return;
  }

  if (isAdminTarget(target)) {
    player.sendClientMessage(Color.error, "Нельзя следить за администратором.");
    return;
  }

  if (!canBeSpectated(target)) {
    player.sendClientMessage(Color.error, "Сейчас за этим игроком нельзя следить.");
    return;
  }

  const existing = sessions.get(adminSlot);
  if (existing?.targetSlot === targetSlot) {
    player.sendClientMessage(Color.gray, "Вы уже следите за этим игроком.");
    return;
  }

  // Без нашей сессии, но уже в спеке (глюк/F4) — иначе returnPoint будет мусором.
  if (!existing && isPlayerSpectating(player)) {
    player.sendClientMessage(
      Color.error,
      "Сначала выйдите из режима камеры: /spoff"
    );
    return;
  }

  if (!existing && !canAdminStartSpectate(player)) {
    player.sendClientMessage(Color.error, "Сейчас нельзя начать слежку.");
    return;
  }

  const returnPoint = existing?.returnPoint ?? readPoint(player);
  if (!returnPoint) {
    player.sendClientMessage(Color.error, "Не удалось сохранить позицию.");
    return;
  }

  leaveVehicle(player);

  if (!attachSpectate(player, target)) {
    player.sendClientMessage(Color.error, "Не удалось начать слежку.");
    if (existing) {
      // Переключение на другую цель сорвалось — вернуть камеру на прежнюю.
      const prev = findTarget(existing.targetSlot);
      if (!prev || !attachSpectate(player, prev)) {
        stopSpectate(player, "Слежка прекращена.");
      }
    } else {
      try {
        player.toggleSpectating(false);
      } catch {
        // Уже не в спеке.
      }
      markSpectating(player, false);
    }
    return;
  }

  let interior = 0;
  let world = 0;
  let vehicleId = -1;
  try {
    interior = target.getInterior();
    world = target.getVirtualWorld();
    if (target.isInAnyVehicle()) {
      vehicleId = target.getVehicleID();
    }
  } catch {
    // Значения по умолчанию.
  }

  sessions.set(adminSlot, {
    targetSlot,
    returnPoint,
    lastInterior: interior,
    lastWorld: world,
    lastVehicleId: vehicleId,
  });
  pendingReturn.delete(adminSlot);
  markSpectating(player, true);

  player.sendClientMessage(
    Color.info,
    `Вы начали слежку за ${playerChatName(target)}.`
  );
  broadcastAdmins(
    `[A] Администратор ${playerChatName(player)} начал слежку за ${playerChatName(target)}.`
  );
}

function tryStopSpectate(player: Player): void {
  const id = playerId(player);
  // Выход из слежки разрешён даже без alogin — иначе можно застрять в спеке.
  if (id !== null && sessions.has(id)) {
    stopSpectate(player, "Вы вышли из режима слежки.");
    return;
  }

  // Сессии нет, но клиент всё ещё в SPECTATING (глюк) — принудительно снять.
  if (isPlayerSpectating(player)) {
    markSpectating(player, false);
    try {
      player.toggleSpectating(false);
    } catch {
      // Уже не в спеке.
    }
    player.sendClientMessage(Color.info, "Вы вышли из режима слежки.");
    return;
  }

  if (hasAdminAccess(player, MIN_LEVEL)) {
    player.sendClientMessage(Color.error, "Вы не в режиме слежки.");
  }
}

function stopSpectate(player: Player, message: string): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const session = sessions.get(id);
  if (!session) {
    return;
  }

  sessions.delete(id);
  pendingReturn.set(id, session.returnPoint);
  markSpectating(player, false);

  try {
    player.toggleSpectating(false);
  } catch {
    pendingReturn.delete(id);
    return;
  }

  // toggleSpectating(false) вызывает playerSpawn — там applyPendingReturn.
  // Fallback, если спавн уже прошёл или событие не пришло.
  setTimeout(() => {
    if (pendingReturn.has(id) && isPlayerActive(player)) {
      applyPendingReturn(player);
    }
  }, RETURN_FALLBACK_MS);

  try {
    player.sendClientMessage(Color.info, message);
  } catch {
    // Уже вышел.
  }
}

function applyPendingReturn(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const point = pendingReturn.get(id);
  if (!point) {
    return;
  }

  pendingReturn.delete(id);

  try {
    placeAt(player, point, { settleMs: false });
    refreshStreamForPlayer(player);
    player.setCameraBehind();
  } catch {
    // Игрок уже вышел.
  }

  markSpectating(player, false);
}

function clearSpectateState(player: Player, restore: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (restore && sessions.has(id)) {
    stopSpectate(player, "Слежка прекращена.");
    return;
  }

  sessions.delete(id);
  pendingReturn.delete(id);
  markSpectating(player, false);

  try {
    if (player.getState() === PLAYER_STATE_SPECTATING) {
      player.toggleSpectating(false);
    }
  } catch {
    // Слот пустой.
  }
}

function syncSpectateSessions(): void {
  if (sessions.size === 0) {
    return;
  }

  for (const [adminSlot, session] of [...sessions]) {
    const admin = omp.players.at(adminSlot);
    if (!admin || !isPlayerActive(admin) || !hasAdminAccess(admin, MIN_LEVEL)) {
      if (admin && isPlayerActive(admin)) {
        stopSpectate(admin, "Слежка прекращена.");
      } else {
        sessions.delete(adminSlot);
        pendingReturn.delete(adminSlot);
      }
      continue;
    }

    const target = findTarget(session.targetSlot);
    if (
      !target ||
      !isAuthenticated(target) ||
      isAdminTarget(target) ||
      !canBeSpectated(target)
    ) {
      stopSpectate(admin, "Игрок недоступен. Слежка прекращена.");
      continue;
    }

    let interior = session.lastInterior;
    let world = session.lastWorld;
    let vehicleId = -1;
    try {
      interior = target.getInterior();
      world = target.getVirtualWorld();
      vehicleId = target.isInAnyVehicle() ? target.getVehicleID() : -1;
    } catch {
      stopSpectate(admin, "Игрок недоступен. Слежка прекращена.");
      continue;
    }

    if (
      interior === session.lastInterior &&
      world === session.lastWorld &&
      vehicleId === session.lastVehicleId
    ) {
      continue;
    }

    if (!attachSpectate(admin, target)) {
      stopSpectate(admin, "Не удалось обновить слежку.");
      continue;
    }

    session.lastInterior = interior;
    session.lastWorld = world;
    session.lastVehicleId = vehicleId;
  }
}

function attachSpectate(admin: Player, target: Player): boolean {
  try {
    const interior = target.getInterior();
    const world = target.getVirtualWorld();
    admin.setInterior(interior);
    admin.setVirtualWorld(world);

    // Порядок важен: сначала spectating, потом цель.
    admin.toggleSpectating(true);

    if (target.isInAnyVehicle()) {
      const vehicle = omp.vehicles.at(target.getVehicleID()) ?? null;
      if (vehicle) {
        spectateVehicle(admin, vehicle);
        return true;
      }
    }

    admin.spectatePlayer(target, SPECTATE_MODE_NORMAL);
    return true;
  } catch {
    return false;
  }
}

/** omp-node typings для SpectateVehicle ошибочно ждут Player; у Vehicle есть getPtr. */
function spectateVehicle(admin: Player, vehicle: Vehicle): void {
  (
    admin as Player & {
      spectateVehicle(target: Vehicle, mode: number): boolean;
    }
  ).spectateVehicle(vehicle, SPECTATE_MODE_NORMAL);
}

function isAdminTarget(target: Player): boolean {
  const account = getAccount(target);
  return !!account && account.adminLevel >= 1;
}

function isPlayerSpectating(player: Player): boolean {
  try {
    return player.getState() === PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function canAdminStartSpectate(player: Player): boolean {
  try {
    if (!player.isSpawned()) {
      return false;
    }

    const state = player.getState();
    return state !== PLAYER_STATE_WASTED && state !== PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function canBeSpectated(target: Player): boolean {
  try {
    if (!target.isSpawned()) {
      return false;
    }

    const state = target.getState();
    return state !== PLAYER_STATE_WASTED && state !== PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function findTarget(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    return null;
  }

  try {
    if (target.isNPC()) {
      return null;
    }
  } catch {
    return null;
  }

  return target;
}

function readPoint(player: Player): SpawnPoint | null {
  try {
    const pos = player.getPos();
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      angle: player.getFacingAngle(),
      interior: player.getInterior(),
      world: player.getVirtualWorld(),
    };
  } catch {
    return null;
  }
}

function leaveVehicle(player: Player): void {
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }
}

function broadcastAdmins(text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !hasAdminAccess(other, 1)) {
      return;
    }

    try {
      other.sendClientMessage(Color.gray, text);
    } catch {
      // Слот пустой.
    }
  });
}
