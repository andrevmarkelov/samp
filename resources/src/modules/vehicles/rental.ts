import {
  Dialog,
  INVALID_VEHICLE_ID,
  omp,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import {
  payVehicleRental,
  setBusinessBalance,
} from "../businesses/repository";
import { registerCommand } from "../commands/registry";
import { STREET_WORLD } from "../spawn/point";
import { createServerVehicle } from "./spawn";

export const VEHICLE_RENT_CONFIRM_DIALOG_ID = 83;

/** Sentinel. */
const MODEL = 405;
const COLOR = 93;
/** Высокий respawn — возвращаем машину только своей логикой. */
const RESPAWN_SEC = 999_999;
/** Стоимость одной аренды (наличные). */
const RENT_PRICE = 500;
/** Сколько ждать возврата в машину после выхода. */
const LEAVE_GRACE_MS = 5 * 60_000;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const DIALOG_STYLE_MSGBOX = 0;
const ANIM_SYNC_ALL = 1;
const DOORS_LOCKED = 1;
const DOORS_UNLOCKED = 0;

/** businesses.id из seed. */
const BIZ_BEACH = 49;
const BIZ_JEFFERSON = 50;

type RentalDef = {
  businessId: number;
  x: number;
  y: number;
  z: number;
  angle: number;
};

type RentalSlot = {
  businessId: number;
  vehicleId: number;
  renterUserId: number | null;
  renterSlotId: number | null;
  leaveTimer: ReturnType<typeof setTimeout> | null;
};

type PendingOffer = {
  vehicleId: number;
  businessId: number;
};

const RENTAL_DEFS: readonly RentalDef[] = [
  // Santa Maria Beach
  { businessId: BIZ_BEACH, x: 334.3301, y: -1789.2019, z: 4.7682, angle: 179.7959 },
  { businessId: BIZ_BEACH, x: 331.1422, y: -1789.157, z: 4.7497, angle: 179.7388 },
  { businessId: BIZ_BEACH, x: 327.9236, y: -1789.142, z: 4.7092, angle: 179.8849 },
  { businessId: BIZ_BEACH, x: 324.6707, y: -1789.1123, z: 4.6569, angle: 180.1387 },
  { businessId: BIZ_BEACH, x: 321.4016, y: -1789.1238, z: 4.6042, angle: 180.3091 },
  // Jefferson
  { businessId: BIZ_JEFFERSON, x: 2161.6045, y: -1143.7134, z: 24.7241, angle: 89.8715 },
  { businessId: BIZ_JEFFERSON, x: 2161.5789, y: -1148.2878, z: 24.2577, angle: 90.3678 },
  { businessId: BIZ_JEFFERSON, x: 2161.5027, y: -1152.8678, z: 23.8071, angle: 89.3174 },
  { businessId: BIZ_JEFFERSON, x: 2161.5012, y: -1158.0037, z: 23.7148, angle: 90.0375 },
  { businessId: BIZ_JEFFERSON, x: 2161.5854, y: -1163.098, z: 23.6917, angle: 90.0087 },
];

const slotsByVehicle = new Map<number, RentalSlot>();
/** userId → vehicleId */
const vehicleByRenter = new Map<number, number>();
/** player slot → vehicleId (нужно на disconnect, когда аккаунт уже сброшен) */
const vehicleBySlot = new Map<number, number>();
const pendingOffer = new Map<number, PendingOffer>();
const paying = new Set<number>();

/** Арендованная (занятая) машина — /respcar её не трогает. */
export function isActiveRentalVehicle(vehicleId: number): boolean {
  const slot = slotsByVehicle.get(vehicleId);
  return !!slot && slot.renterUserId !== null;
}

export function spawnRentalVehicles(): void {
  for (const def of RENTAL_DEFS) {
    const vehicle = createServerVehicle({
      model: MODEL,
      x: def.x,
      y: def.y,
      z: def.z,
      angle: def.angle,
      color1: COLOR,
      color2: COLOR,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (!vehicle) {
      omp.log(`[${SERVER_TAG}] аренда авто: не удалось создать машину бизнеса #${def.businessId}`);
      continue;
    }

    const vehicleId = liveVehicleId(vehicle);
    if (vehicleId === null) {
      continue;
    }

    slotsByVehicle.set(vehicleId, {
      businessId: def.businessId,
      vehicleId,
      renterUserId: null,
      renterSlotId: null,
      leaveTimer: null,
    });
  }

  bindRentalEvents();
  registerCommand("unrent", "Завершить аренду автомобиля", (player) => {
    endPlayerRental(player, "command");
  });

  omp.log(`[${SERVER_TAG}] аренда авто: ${slotsByVehicle.size} машин`);
}

function bindRentalEvents(): void {
  omp.on("vehicleStreamIn", (vehicle, player) => {
    applyRentalDoorLock(vehicle, player);
  });

  omp.on("playerStateChange", (player, newState, oldState) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    if (newState === PLAYER_STATE_DRIVER || newState === PLAYER_STATE_PASSENGER) {
      handleEnterRental(player, newState === PLAYER_STATE_PASSENGER);
      return;
    }

    if (
      oldState === PLAYER_STATE_DRIVER &&
      newState !== PLAYER_STATE_DRIVER &&
      newState !== PLAYER_STATE_PASSENGER
    ) {
      const leaveSlotId = playerId(player);
      if (leaveSlotId !== null && pendingOffer.has(leaveSlotId)) {
        // Закрыл диалог выходом из машины — разморозить.
        pendingOffer.delete(leaveSlotId);
        setControllable(player, true);
      }
      handleLeaveRental(player);
    }
  });

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== VEHICLE_RENT_CONFIRM_DIALOG_ID) {
      return;
    }

    void handleRentDialog(player, Number(response) !== 0);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      if (pendingOffer.has(slotId)) {
        setControllable(player, true);
      }
      pendingOffer.delete(slotId);
    }

    const account = getAccount(player);
    if (account) {
      paying.delete(account.id);
    }

    // Аккаунт к этому моменту может быть уже очищен — ищем аренду по слоту.
    endRentalOnDisconnect(player, slotId, account?.id ?? null);
  });
}

function handleEnterRental(player: Player, asPassenger: boolean): void {
  let vehicle: Vehicle | null = null;
  try {
    vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return;
  }
  if (!vehicle) {
    return;
  }

  const vehicleId = liveVehicleId(vehicle);
  if (vehicleId === null) {
    return;
  }

  const slot = slotsByVehicle.get(vehicleId);
  if (!slot) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    eject(player);
    return;
  }

  // Уже арендована другим — нельзя садиться.
  if (slot.renterUserId !== null && slot.renterUserId !== account.id) {
    player.sendClientMessage(Color.error, "Этот автомобиль уже арендован.");
    eject(player);
    return;
  }

  // Своя аренда — вернулся в машину, сбрасываем таймер.
  if (slot.renterUserId === account.id) {
    clearLeaveTimer(slot);
    return;
  }

  // Свободная машина, но игрок уже арендует другую.
  const ownedVehicleId = vehicleByRenter.get(account.id);
  if (ownedVehicleId !== undefined) {
    player.sendClientMessage(
      Color.error,
      "Вы уже арендуете автомобиль. Чтобы завершить аренду, введите /unrent."
    );
    eject(player);
    return;
  }

  // Пассажир не может начать аренду.
  if (asPassenger) {
    player.sendClientMessage(Color.error, "Чтобы арендовать, сядьте за руль.");
    eject(player);
    return;
  }

  // Нужны права на авто (дубль на случай обхода access).
  if (!account.licenses.car) {
    player.sendClientMessage(Color.error, "У вас нет лицензии на автомобили.");
    eject(player);
    return;
  }

  showRentConfirm(player, slot);
}

function showRentConfirm(player: Player, slot: RentalSlot): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  pendingOffer.set(slotId, {
    vehicleId: slot.vehicleId,
    businessId: slot.businessId,
  });

  // Пока диалог открыт — нельзя уехать бесплатно.
  setControllable(player, false);

  try {
    Dialog.show(
      player,
      VEHICLE_RENT_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Аренда автомобиля",
      [
        "Вы хотите арендовать этот автомобиль?",
        "",
        `Стоимость: ${formatMoney(RENT_PRICE)}`,
        "Оплата наличными.",
        "",
        "Завершить аренду: /unrent",
      ].join("\n"),
      "Аренда",
      "Отмена"
    );
  } catch {
    pendingOffer.delete(slotId);
    setControllable(player, true);
    eject(player);
    player.sendClientMessage(Color.error, "Не удалось открыть окно аренды.");
  }
}

async function handleRentDialog(player: Player, accepted: boolean): Promise<void> {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const pending = pendingOffer.get(slotId);
  pendingOffer.delete(slotId);

  if (!pending) {
    return;
  }

  if (!accepted) {
    setControllable(player, true);
    eject(player);
    return;
  }

  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    setControllable(player, true);
    return;
  }

  const account = getAccount(player);
  if (!account) {
    setControllable(player, true);
    eject(player);
    return;
  }

  if (!account.licenses.car) {
    setControllable(player, true);
    player.sendClientMessage(Color.error, "У вас нет лицензии на автомобили.");
    eject(player);
    return;
  }

  if (vehicleByRenter.has(account.id)) {
    setControllable(player, true);
    player.sendClientMessage(
      Color.error,
      "Вы уже арендуете автомобиль. Чтобы завершить аренду, введите /unrent."
    );
    eject(player);
    return;
  }

  const slot = slotsByVehicle.get(pending.vehicleId);
  if (!slot || slot.renterUserId !== null) {
    setControllable(player, true);
    player.sendClientMessage(Color.error, "Этот автомобиль уже арендован.");
    eject(player);
    return;
  }

  // Игрок должен всё ещё сидеть в этой машине.
  if (!isDriverOf(player, pending.vehicleId)) {
    setControllable(player, true);
    player.sendClientMessage(Color.error, "Сядьте в автомобиль, чтобы арендовать его.");
    return;
  }

  if (Math.max(0, Math.floor(account.money)) < RENT_PRICE) {
    setControllable(player, true);
    player.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(RENT_PRICE)}.`
    );
    eject(player);
    return;
  }

  if (paying.has(account.id)) {
    setControllable(player, true);
    eject(player);
    return;
  }

  // Резерв до оплаты — второй игрок не перехватит слот.
  assignRental(slot, account.id, slotId);
  clearLeaveTimer(slot);
  refreshDoorLocks(pending.vehicleId);

  paying.add(account.id);
  let result;
  try {
    result = await payVehicleRental(pending.businessId, account.id, RENT_PRICE);
  } catch (error: unknown) {
    paying.delete(account.id);
    releaseReservation(account.id, pending.vehicleId);
    setControllable(player, true);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] аренда авто бизнес #${pending.businessId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Аренда не прошла. Попробуйте ещё раз.");
    eject(player);
    return;
  }
  paying.delete(account.id);

  if (!result.ok) {
    releaseReservation(account.id, pending.vehicleId);
    setControllable(player, true);
    if (result.reason === "funds") {
      player.sendClientMessage(
        Color.error,
        `Недостаточно наличных. Нужно ${formatMoney(RENT_PRICE)}.`
      );
    } else {
      player.sendClientMessage(Color.error, "Аренда не прошла. Попробуйте ещё раз.");
    }
    eject(player);
    return;
  }

  setBusinessBalance(pending.businessId, result.balance);

  // Вышел из игры во время оплаты — аренду уже сняли в disconnect.
  const liveSlot = slotsByVehicle.get(pending.vehicleId);
  if (!liveSlot || liveSlot.renterUserId !== account.id) {
    setControllable(player, true);
    return;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    // Не оставляем «призрачную» аренду на 5 минут — сразу сдаём машину.
    forceEndRentalByUser(account.id, "disconnect");
    return;
  }

  setControllable(player, true);
  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  if (!isDriverOf(player, pending.vehicleId)) {
    // Оплатил, но уже вышел — 5 минут на возврат.
    handleLeaveRental(player);
  }

  player.sendClientMessage(
    Color.tryOk,
    `Вы арендовали автомобиль за ${formatMoney(result.amount)}. Завершить: /unrent.`
  );
  player.sendClientMessage(
    Color.gray,
    "Если выйти из машины, у вас есть 5 минут, чтобы вернуться."
  );
}

function assignRental(slot: RentalSlot, userId: number, slotId: number): void {
  slot.renterUserId = userId;
  slot.renterSlotId = slotId;
  vehicleByRenter.set(userId, slot.vehicleId);
  vehicleBySlot.set(slotId, slot.vehicleId);
}

function releaseReservation(userId: number, vehicleId: number): void {
  const slot = slotsByVehicle.get(vehicleId);
  if (slot?.renterSlotId !== null && slot?.renterSlotId !== undefined) {
    vehicleBySlot.delete(slot.renterSlotId);
  }
  vehicleByRenter.delete(userId);
  if (!slot || slot.renterUserId !== userId) {
    return;
  }

  clearLeaveTimer(slot);
  slot.renterUserId = null;
  slot.renterSlotId = null;
  refreshDoorLocks(vehicleId);
}

function endRentalOnDisconnect(
  player: Player,
  slotId: number | null,
  userId: number | null
): void {
  let vehicleId: number | undefined;
  if (slotId !== null) {
    vehicleId = vehicleBySlot.get(slotId);
  }
  if (vehicleId === undefined && userId !== null) {
    vehicleId = vehicleByRenter.get(userId);
  }
  if (vehicleId === undefined) {
    return;
  }

  const slot = slotsByVehicle.get(vehicleId);
  const ownerId = slot?.renterUserId ?? userId;
  if (ownerId !== null && ownerId !== undefined) {
    forceEndRentalByUser(ownerId, "disconnect");
    return;
  }

  // На всякий случай: очистка только по слоту.
  if (slotId !== null) {
    vehicleBySlot.delete(slotId);
  }
  if (slot) {
    clearLeaveTimer(slot);
    slot.renterUserId = null;
    slot.renterSlotId = null;
  }
  try {
    player.removeFromVehicle();
  } catch {
    // Уже не в машине.
  }
  ejectOccupants(vehicleId);
  respawnRentalVehicle(vehicleId);
  refreshDoorLocks(vehicleId);
}

function handleLeaveRental(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const vehicleId = vehicleByRenter.get(account.id);
  if (vehicleId === undefined) {
    return;
  }

  const slot = slotsByVehicle.get(vehicleId);
  if (!slot || slot.renterUserId !== account.id) {
    return;
  }

  clearLeaveTimer(slot);
  slot.leaveTimer = setTimeout(() => {
    slot.leaveTimer = null;
    forceEndRentalByUser(account.id, "timeout");
  }, LEAVE_GRACE_MS);

  try {
    player.sendClientMessage(
      Color.gray,
      "У вас есть 5 минут, чтобы вернуться в арендованный автомобиль."
    );
  } catch {
    // Игрок уже вышел.
  }
}

function endPlayerRental(player: Player, reason: "command" | "timeout" | "disconnect"): void {
  const account = getAccount(player);
  if (!account) {
    if (reason === "command") {
      player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    }
    return;
  }

  if (!vehicleByRenter.has(account.id)) {
    if (reason === "command") {
      player.sendClientMessage(Color.error, "У вас нет арендованного автомобиля.");
    }
    return;
  }

  if (reason === "command") {
    try {
      if (player.isInAnyVehicle()) {
        const vid = player.getVehicleID();
        const owned = vehicleByRenter.get(account.id);
        if (owned !== undefined && vid === owned) {
          eject(player);
        }
      }
    } catch {
      // Слот пустой.
    }
  }

  forceEndRentalByUser(account.id, reason);

  if (reason === "command" && isPlayerActive(player)) {
    player.sendClientMessage(Color.info, "Аренда автомобиля завершена.");
  }
}

function forceEndRentalByUser(
  userId: number,
  reason: "command" | "timeout" | "disconnect"
): void {
  const vehicleId = vehicleByRenter.get(userId);
  if (vehicleId === undefined) {
    return;
  }

  vehicleByRenter.delete(userId);
  const slot = slotsByVehicle.get(vehicleId);
  if (slot?.renterSlotId !== null && slot?.renterSlotId !== undefined) {
    vehicleBySlot.delete(slot.renterSlotId);
  }
  if (!slot) {
    return;
  }

  clearLeaveTimer(slot);
  slot.renterUserId = null;
  slot.renterSlotId = null;

  // Выкинуть чужих/арендатора, если ещё в машине.
  ejectOccupants(vehicleId);
  respawnRentalVehicle(vehicleId);
  refreshDoorLocks(vehicleId);

  if (reason === "timeout") {
    notifyUser(userId, Color.error, "Время аренды истекло: вы не вернулись в автомобиль.");
  }
}

function respawnRentalVehicle(vehicleId: number): void {
  const vehicle = omp.vehicles.at(vehicleId);
  if (!vehicle) {
    return;
  }

  try {
    vehicle.setToRespawn();
  } catch {
    // Уже уничтожена.
  }
}

function refreshDoorLocks(vehicleId: number): void {
  const vehicle = omp.vehicles.at(vehicleId);
  if (!vehicle) {
    return;
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player)) {
      return;
    }
    applyRentalDoorLock(vehicle, player);
  });
}

function applyRentalDoorLock(vehicle: Vehicle, player: Player): void {
  const vehicleId = liveVehicleId(vehicle);
  if (vehicleId === null) {
    return;
  }

  const slot = slotsByVehicle.get(vehicleId);
  if (!slot) {
    return;
  }

  const account = getAccount(player);
  const allowed =
    slot.renterUserId === null ||
    (account !== null && slot.renterUserId === account.id);

  try {
    vehicle.setParamsForPlayer(player, 0, allowed ? DOORS_UNLOCKED : DOORS_LOCKED);
  } catch {
    // Слот или транспорт уже не в мире.
  }
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
    return (
      player.getState() === PLAYER_STATE_DRIVER &&
      player.getVehicleID() === vehicleId
    );
  } catch {
    return false;
  }
}

function eject(player: Player): void {
  try {
    player.clearAnimations(ANIM_SYNC_ALL);
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

function clearLeaveTimer(slot: RentalSlot): void {
  if (slot.leaveTimer) {
    clearTimeout(slot.leaveTimer);
    slot.leaveTimer = null;
  }
}

function notifyUser(userId: number, color: number, text: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.id !== userId) {
      return;
    }

    try {
      player.sendClientMessage(color, text);
    } catch {
      // Игрок уже вышел.
    }
  });
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
