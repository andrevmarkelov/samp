import { Dialog, omp, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { queueSave } from "../persist";
import { STREET_WORLD } from "../spawn/point";
import { createServerVehicle } from "./spawn";

export const LIMO_RENT_DIALOG_ID = 167;

const MODEL = 409;
const COLOR = 1;
const RESPAWN_SEC = 999_999;
const RENT_PRICE = 1500;
const LEAVE_GRACE_MS = 30_000;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const PLAYER_STATE_WASTED = 7;
const RESPAWN_AFTER_DEATH_MS = 500;
const DIALOG_STYLE_MSGBOX = 0;
const ANIM_SYNC_ALL = 1;

const SPAWN = {
  x: 2280.9358,
  y: -50.5465,
  z: 26.8178,
  angle: 0.5608,
} as const;

type LimoSlot = {
  vehicleId: number;
  renterUserId: number | null;
  renterSlotId: number | null;
  /** Арендатор сейчас сидит в лимузине. Выход из другой машины таймер не трогает. */
  seated: boolean;
  leaveTimer: ReturnType<typeof setTimeout> | null;
};

const slotRef: { current: LimoSlot | null } = { current: null };
const pendingOffer = new Set<number>();
let eventsBound = false;

/** Занятый лимузин не забирает /respcar, пока арендатор не вернулся. */
export function isActiveLimoRental(vehicleId: number): boolean {
  const slot = slotRef.current;
  return !!slot && slot.vehicleId === vehicleId && slot.renterUserId !== null;
}

export function spawnLimoRental(): void {
  const vehicle = createServerVehicle({
    model: MODEL,
    x: SPAWN.x,
    y: SPAWN.y,
    z: SPAWN.z,
    angle: SPAWN.angle,
    color1: COLOR,
    color2: COLOR,
    respawnSec: RESPAWN_SEC,
    world: STREET_WORLD,
  });
  if (!vehicle) {
    omp.log(`[${SERVER_TAG}] лимузин: не удалось создать машину`);
    return;
  }

  const vehicleId = liveVehicleId(vehicle);
  const ptr = vehiclePtr(vehicle);
  if (vehicleId === null || ptr === null) {
    try {
      vehicle.destroy();
    } catch {
      // Уже снята.
    }
    omp.log(`[${SERVER_TAG}] лимузин: машина без id`);
    return;
  }

  slotRef.current = {
    vehicleId,
    renterUserId: null,
    renterSlotId: null,
    seated: false,
    leaveTimer: null,
  };
  bindLimo();
}

/** Тюрьма, смерть и выход снимают аренду сразу. */
export function endLimoRental(player: Player, reason: "jail" | "death" | "disconnect"): void {
  const offered = playerId(player);
  if (offered !== null && pendingOffer.has(offered)) {
    pendingOffer.delete(offered);
    setControllable(player, true);
  }

  const slot = slotRef.current;
  if (!slot || slot.renterUserId === null) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  const owns =
    (account !== null && slot.renterUserId === account.id) ||
    (slotId !== null && slot.renterSlotId === slotId);
  if (!owns) {
    return;
  }

  finishRental();
  if (reason === "jail" && isPlayerActive(player)) {
    player.sendClientMessage(Color.error, "Аренда лимузина завершена.");
  }
  if (reason === "death" && isPlayerActive(player)) {
    player.sendClientMessage(Color.error, "Аренда лимузина завершена.");
  }
}

function bindLimo(): void {
  if (eventsBound) {
    return;
  }
  eventsBound = true;

  omp.on("playerStateChange", (player, newState, oldState) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    if (newState === PLAYER_STATE_WASTED) {
      endLimoRental(player, "death");
      return;
    }

    if (newState === PLAYER_STATE_DRIVER || newState === PLAYER_STATE_PASSENGER) {
      handleEnter(player, newState === PLAYER_STATE_PASSENGER);
      return;
    }

    if (
      (oldState === PLAYER_STATE_DRIVER || oldState === PLAYER_STATE_PASSENGER) &&
      newState !== PLAYER_STATE_DRIVER &&
      newState !== PLAYER_STATE_PASSENGER
    ) {
      const slotId = playerId(player);
      if (slotId !== null && pendingOffer.has(slotId)) {
        pendingOffer.delete(slotId);
        setControllable(player, true);
      }
      handleLeave(player);
    }
  });

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== LIMO_RENT_DIALOG_ID || !isPlayerActive(player)) {
      return;
    }
    handleDialog(player, Number(response) !== 0);
  });

  omp.on("playerDeath", (player) => {
    endLimoRental(player, "death");
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null && pendingOffer.has(slotId)) {
      pendingOffer.delete(slotId);
      setControllable(player, true);
    }
    endLimoRental(player, "disconnect");
  });

  omp.on("vehicleDeath", (vehicle) => {
    const slot = slotRef.current;
    if (!slot || liveVehicleId(vehicle) !== slot.vehicleId) {
      return;
    }
    const userId = slot.renterUserId;
    finishRental(RESPAWN_AFTER_DEATH_MS);
    if (userId !== null) {
      notify(userId, "Аренда лимузина завершена.");
    }
  });
}

function handleEnter(player: Player, asPassenger: boolean): void {
  const slot = slotRef.current;
  if (!slot) {
    return;
  }

  let vehicleId = -1;
  try {
    vehicleId = player.getVehicleID();
  } catch {
    return;
  }
  if (vehicleId !== slot.vehicleId) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    eject(player);
    return;
  }

  if (slot.renterUserId !== null && slot.renterUserId !== account.id) {
    player.sendClientMessage(Color.error, "Этот лимузин уже арендован.");
    eject(player);
    return;
  }

  if (slot.renterUserId === account.id) {
    slot.seated = true;
    if (slot.leaveTimer) {
      clearLeaveTimer(slot);
      player.sendClientMessage(Color.tryOk, "Вы вернулись в лимузин.");
    }
    return;
  }

  if (asPassenger) {
    player.sendClientMessage(Color.error, "Чтобы арендовать лимузин, сядьте за руль.");
    eject(player);
    return;
  }

  if (!account.licenses.car) {
    eject(player);
    return;
  }

  pendingOffer.add(slotId);
  setControllable(player, false);
  try {
    Dialog.show(
      player,
      LIMO_RENT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Аренда лимузина",
      `{FFFFFF}Арендовать лимузин?\nСтоимость: {33CCFF}${formatMoney(RENT_PRICE)}\n\n{FFFFFF}Если выйти из машины, есть 30 секунд, чтобы вернуться.`,
      "Арендовать",
      "Отмена"
    );
  } catch {
    pendingOffer.delete(slotId);
    setControllable(player, true);
    eject(player);
  }
}

function handleDialog(player: Player, accepted: boolean): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }
  pendingOffer.delete(slotId);
  setControllable(player, true);

  const slot = slotRef.current;
  if (!slot) {
    return;
  }

  if (!accepted) {
    eject(player);
    return;
  }

  const account = getAccount(player);
  if (!account || !isAuthenticated(player)) {
    eject(player);
    return;
  }
  if (!account.licenses.car) {
    player.sendClientMessage(Color.error, "У вас нет лицензии на автомобили.");
    eject(player);
    return;
  }
  if (slot.renterUserId !== null) {
    player.sendClientMessage(Color.error, "Этот лимузин уже арендован.");
    eject(player);
    return;
  }
  if (!isDriverOf(player, slot.vehicleId)) {
    player.sendClientMessage(Color.error, "Сядьте за руль лимузина, чтобы арендовать его.");
    return;
  }
  if (account.money < RENT_PRICE) {
    player.sendClientMessage(Color.error, `Недостаточно наличных. Нужно ${formatMoney(RENT_PRICE)}.`);
    eject(player);
    return;
  }

  const next = account.money - RENT_PRICE;
  patchAccount(player, { money: next });
  const paid = getAccount(player);
  if (!paid) {
    eject(player);
    return;
  }
  applyWallet(player, paid);
  queueSave(player);

  slot.renterUserId = paid.id;
  slot.renterSlotId = slotId;
  slot.seated = true;
  clearLeaveTimer(slot);
  player.sendClientMessage(Color.tryOk, `Вы арендовали лимузин за ${formatMoney(RENT_PRICE)}.`);
  player.sendClientMessage(Color.gray, "Если выйти из машины, у вас есть 30 секунд, чтобы вернуться.");
}

function handleLeave(player: Player): void {
  const slot = slotRef.current;
  const account = getAccount(player);
  if (!slot || !account || slot.renterUserId !== account.id || !slot.seated) {
    return;
  }
  if (isDead(player)) {
    endLimoRental(player, "death");
    return;
  }
  if (account.jailSeconds > 0) {
    return;
  }

  slot.seated = false;
  clearLeaveTimer(slot);
  const userId = account.id;
  slot.leaveTimer = setTimeout(() => {
    const live = slotRef.current;
    if (!live || live.renterUserId !== userId || live.seated) {
      return;
    }
    live.leaveTimer = null;
    finishRental();
    notify(userId, "Аренда лимузина завершена: вы не вернулись в машину.");
  }, LEAVE_GRACE_MS);

  try {
    player.sendClientMessage(Color.gray, "У вас есть 30 секунд, чтобы вернуться в лимузин.");
  } catch {
    // Игрок уже вышел.
  }
}

function finishRental(respawnDelayMs = 0): void {
  const slot = slotRef.current;
  if (!slot) {
    return;
  }
  const rented = slot.renterUserId !== null;
  clearLeaveTimer(slot);
  slot.renterUserId = null;
  slot.renterSlotId = null;
  slot.seated = false;
  if (rented) {
    ejectOccupants(slot.vehicleId);
  }
  respawn(slot, respawnDelayMs);
}

function respawn(slot: LimoSlot, delayMs: number): void {
  const run = () => {
    const current = slotRef.current;
    if (!current || current.vehicleId !== slot.vehicleId) {
      return;
    }
    const vehicle = omp.vehicles.at(slot.vehicleId);
    if (!vehicle) {
      return;
    }
    try {
      vehicle.setToRespawn();
    } catch {
      // Уже уничтожена.
    }
  };

  if (delayMs > 0) {
    setTimeout(run, delayMs);
    return;
  }
  run();
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

function isDriverOf(player: Player, vehicleId: number): boolean {
  try {
    return player.getState() === PLAYER_STATE_DRIVER && player.getVehicleID() === vehicleId;
  } catch {
    return false;
  }
}

function isDead(player: Player): boolean {
  try {
    return player.getHealth() <= 0 || player.getState() === PLAYER_STATE_WASTED;
  } catch {
    return true;
  }
}

function eject(player: Player): void {
  const dead = isDead(player);
  try {
    if (!dead) {
      player.clearAnimations(ANIM_SYNC_ALL);
    }
    player.removeFromVehicle();
  } catch {
    // Уже не в транспорте.
  }
}

function setControllable(player: Player, enabled: boolean): void {
  try {
    player.toggleControllable(enabled);
  } catch {
    // Слот пустой.
  }
}

function clearLeaveTimer(slot: LimoSlot): void {
  if (slot.leaveTimer) {
    clearTimeout(slot.leaveTimer);
    slot.leaveTimer = null;
  }
}

function notify(userId: number, text: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }
    const account = getAccount(player);
    if (account?.id === userId) {
      player.sendClientMessage(Color.error, text);
    }
  });
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    return id === null || id === undefined ? null : Number(id);
  } catch {
    return null;
  }
}

function vehiclePtr(vehicle: Vehicle): number | null {
  try {
    const ptr = vehicle.getPtr();
    return ptr === null || ptr === undefined ? null : Number(ptr);
  } catch {
    return null;
  }
}
