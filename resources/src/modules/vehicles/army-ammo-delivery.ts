import {
  Checkpoint,
  INVALID_VEHICLE_ID,
  omp,
  Pickup,
  TextLabel,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { registerCommand } from "../commands/registry";
import {
  ORG_ARMY_ID,
  ORG_FBI_ID,
  ORG_LSPD_ID,
  ORG_POLICE_ID,
  getMembership,
} from "../org";
import { refreshArmyAmmoStockLabel } from "../org/army-locker";
import { refreshFbiAmmoStockLabel } from "../org/fbi-locker";
import { refreshLspdAmmoStockLabel } from "../org/lspd-locker";
import { refreshPoliceAmmoStockLabel } from "../org/police-locker";
import { queueSave } from "../persist";
import { STREET_WORLD } from "../spawn/point";
import { addWarehouseAmmo, takeWarehouseAmmo } from "../warehouse";

const TRUCK_MODEL = 433;
const MAX_CRATES = 5;
/** Патронов в одном ящике (списывается со склада Армии при взятии). */
const AMMO_PER_CRATE = 100;
const PAY_PER_CRATE = 75;

const STOCK_PICKUP_MODEL = 19134;
const CRATE_MODEL = 2358;
const PICKUP_TYPE = 1;
const STOCK_RADIUS = 1.6;
const TRUCK_RANGE = 6;
const DROP_DETECT_RADIUS = 10;
const CHECKPOINT_RADIUS = 1.8;
const TICK_MS = 200;

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const ANIM_SYNC_ALL = 1;
const SPECIAL_ACTION_NONE = 0;
const SPECIAL_ACTION_CARRY = 25;
const SLOT_CRATE = 1;

const LABEL_DRAW_DISTANCE = 40;
const LABEL_OFFSET_Z = 2.5;
/** Слегка жёлто-оранжевый текст лейбла груза. */
const LABEL_COLOR = 0xffaa33ff;

const STOCK_POINT = {
  x: 2735.9465,
  y: -2465.979,
  z: 13.6484,
} as const;

type DropPoint = {
  orgId: number;
  name: string;
  x: number;
  y: number;
  z: number;
};

const DROP_POINTS: readonly DropPoint[] = [
  {
    orgId: ORG_FBI_ID,
    name: "FBI",
    x: 607.3113,
    y: -1520.4983,
    z: 15.034,
  },
  {
    orgId: ORG_POLICE_ID,
    name: "Областная полиция",
    x: 618.8522,
    y: -586.4384,
    z: 17.233,
  },
  {
    orgId: ORG_LSPD_ID,
    name: "LSPD",
    x: 1593.8608,
    y: -1614.2993,
    z: 13.3955,
  },
];

type TruckCargo = {
  crates: number;
  label: TextLabel | null;
};

/** Источник ящика в руках: склад базы или id грузовика. */
type CarrySource = "stock" | number;

type CarryState = {
  source: CarrySource;
  /** Активный чекпоинт разгрузки (orgId), если рядом с точкой. */
  dropOrgId: number | null;
};

const trucks = new Map<number, TruckCargo>();
const carrying = new Map<number, CarryState>();
const atStock = new Set<number>();
const atDrop = new Set<number>();

let bound = false;

export function isArmyAmmoCarrying(player: Player): boolean {
  const id = playerId(player);
  return id !== null && carrying.has(id);
}

/** Привязать Barracks (433) к системе ящиков. */
export function bindArmyAmmoTruck(vehicle: Vehicle): void {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    setTimeout(() => bindArmyAmmoTruck(vehicle), 0);
    return;
  }

  const prev = trucks.get(id);
  if (prev) {
    destroyLabel(prev.label);
  }

  trucks.set(id, { crates: 0, label: null });
}

export function bindArmyAmmoDelivery(): void {
  if (bound) {
    return;
  }
  bound = true;

  new Pickup(
    STOCK_PICKUP_MODEL,
    PICKUP_TYPE,
    STOCK_POINT.x,
    STOCK_POINT.y,
    STOCK_POINT.z,
    STREET_WORLD
  );
  new TextLabel(
    "Склад патронов\nЯщики для доставки",
    Color.info,
    STOCK_POINT.x,
    STOCK_POINT.y,
    STOCK_POINT.z + 0.9,
    18,
    STREET_WORLD,
    false
  );

  registerCommand("putammo", "Положить ящик с патронами в грузовик", (player) => {
    onPutAmmo(player);
  });
  registerCommand("takeammo", "Взять ящик с патронами из грузовика", (player) => {
    onTakeAmmo(player);
  });

  setInterval(tickDelivery, TICK_MS);

  omp.on("vehicleSpawn", (vehicle) => {
    onTruckRespawn(vehicle);
  });

  omp.on("playerEnterCheckpoint", (player) => {
    onDropCheckpoint(player);
  });

  omp.on("playerStateChange", (player, newState) => {
    if (
      newState === PLAYER_STATE_DRIVER ||
      newState === PLAYER_STATE_PASSENGER
    ) {
      returnCarried(player, "Вы сели в транспорт — патроны возвращены на склад.");
    }
  });

  omp.on("playerDeath", (player) => {
    returnCarried(player, "Вы потеряли ящик — патроны возвращены на склад.");
  });

  omp.on("playerDisconnect", (player) => {
    returnCarried(player, null);
    clearPlayer(player);
  });

  omp.on("playerConnect", (player) => {
    // Слот мог остаться «грязным» после краша без disconnect — сначала возврат на склад.
    returnCarried(player, null);
    clearPlayer(player);
  });
}

function tickDelivery(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        atStock.delete(id);
        clearDropCheckpoint(player, id);
        return;
      }

      if (
        player.getVirtualWorld() !== STREET_WORLD ||
        player.getInterior() !== 0
      ) {
        atStock.delete(id);
        clearDropCheckpoint(player, id);
        return;
      }

      tickStockPickup(player, id);
      tickDropProximity(player, id);
    } catch {
      // Слот пустой.
    }
  });
}

function tickStockPickup(player: Player, id: number): void {
  if (carrying.has(id)) {
    atStock.delete(id);
    return;
  }

  const pos = player.getPos();
  const dist = Math.hypot(
    pos.x - STOCK_POINT.x,
    pos.y - STOCK_POINT.y,
    pos.z - STOCK_POINT.z
  );
  if (dist > STOCK_RADIUS) {
    atStock.delete(id);
    return;
  }

  if (atStock.has(id)) {
    return;
  }

  atStock.add(id);
  tryTakeFromStock(player, id);
}

function tryTakeFromStock(player: Player, id: number): void {
  if (!isArmyMember(player)) {
    player.sendClientMessage(Color.error, "Ящики может брать только Армия.");
    return;
  }

  if (carrying.has(id)) {
    return;
  }

  if (!takeWarehouseAmmo(ORG_ARMY_ID, AMMO_PER_CRATE)) {
    // Снимаем «залипание» на пикапе, чтобы после пополнения склада можно было взять снова.
    atStock.delete(id);
    player.sendClientMessage(
      Color.error,
      `На складе Армии недостаточно патронов (нужно ${AMMO_PER_CRATE}).`
    );
    return;
  }

  if (!giveCrate(player)) {
    addWarehouseAmmo(ORG_ARMY_ID, AMMO_PER_CRATE);
    refreshArmyAmmoStockLabel();
    atStock.delete(id);
    player.sendClientMessage(Color.error, "Не удалось взять ящик. Попробуйте ещё раз.");
    return;
  }

  refreshArmyAmmoStockLabel();
  carrying.set(id, { source: "stock", dropOrgId: null });
  player.sendClientMessage(
    Color.info,
    `Ящик в руках (+${AMMO_PER_CRATE} патронов). Подойдите к Barracks и введите /putammo.`
  );
}

function tickDropProximity(player: Player, id: number): void {
  const carry = carrying.get(id);
  if (!carry) {
    clearDropCheckpoint(player, id);
    return;
  }

  const near = nearestDrop(player);
  if (!near) {
    clearDropCheckpoint(player, id);
    return;
  }

  if (carry.dropOrgId === near.orgId) {
    return;
  }

  carry.dropOrgId = near.orgId;
  try {
    Checkpoint.set(player, near.x, near.y, near.z, CHECKPOINT_RADIUS);
    if (!atDrop.has(id)) {
      atDrop.add(id);
      player.sendClientMessage(
        Color.info,
        `Точка разгрузки: ${near.name}. Встаньте на чекпоинт.`
      );
    }
  } catch {
    carry.dropOrgId = null;
  }
}

function clearDropCheckpoint(player: Player, id: number): void {
  const carry = carrying.get(id);
  const hadDrop =
    atDrop.has(id) || (carry !== undefined && carry.dropOrgId !== null);

  if (carry) {
    carry.dropOrgId = null;
  }
  atDrop.delete(id);

  if (!hadDrop) {
    return;
  }

  try {
    Checkpoint.disable(player);
  } catch {
    // Уже выключен.
  }
}

function onDropCheckpoint(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const carry = carrying.get(id);
  if (!carry || carry.dropOrgId === null) {
    return;
  }

  const drop = DROP_POINTS.find((p) => p.orgId === carry.dropOrgId);
  if (!drop) {
    return;
  }

  if (!isNearPoint(player, drop, CHECKPOINT_RADIUS + 2)) {
    return;
  }

  if (!isArmyMember(player)) {
    player.sendClientMessage(Color.error, "Разгружать может только Армия.");
    return;
  }

  carrying.delete(id);
  atDrop.delete(id);
  clearCrate(player);
  try {
    Checkpoint.disable(player);
  } catch {
    // Ок.
  }

  const total = addWarehouseAmmo(drop.orgId, AMMO_PER_CRATE);
  refreshDestLabel(drop.orgId);
  payPlayer(player, PAY_PER_CRATE);

  player.sendClientMessage(
    Color.info,
    `${drop.name}: сдано +${AMMO_PER_CRATE} патронов (склад: ${total}). +$${PAY_PER_CRATE}`
  );
}

function onPutAmmo(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (!isArmyMember(player)) {
    player.sendClientMessage(Color.error, "Команда только для Армии.");
    return;
  }

  const carry = carrying.get(id);
  if (!carry) {
    player.sendClientMessage(Color.error, "У вас нет ящика в руках.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Нужно быть пешком у грузовика.");
      return;
    }
  } catch {
    return;
  }

  const truck = nearestArmyTruck(player, TRUCK_RANGE);
  if (!truck) {
    player.sendClientMessage(Color.error, "Рядом нет грузовика Barracks (433).");
    return;
  }

  const truckId = liveVehicleId(truck);
  if (truckId === null) {
    return;
  }

  ensureTruck(truckId, truck);
  const cargo = trucks.get(truckId);
  if (!cargo) {
    return;
  }

  if (cargo.crates >= MAX_CRATES) {
    player.sendClientMessage(
      Color.error,
      `В грузовике уже максимум ящиков (${MAX_CRATES}).`
    );
    return;
  }

  cargo.crates += 1;
  updateTruckLabel(truckId, cargo);
  carrying.delete(id);
  clearDropCheckpoint(player, id);
  clearCrate(player);

  player.sendClientMessage(
    Color.info,
    `Ящик загружен. В кузове: ${cargo.crates}/${MAX_CRATES}.`
  );
}

function onTakeAmmo(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (!isArmyMember(player)) {
    player.sendClientMessage(Color.error, "Команда только для Армии.");
    return;
  }

  if (carrying.has(id)) {
    player.sendClientMessage(Color.error, "У вас уже есть ящик в руках.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Нужно быть пешком у грузовика.");
      return;
    }
  } catch {
    return;
  }

  const truck = nearestArmyTruck(player, TRUCK_RANGE);
  if (!truck) {
    player.sendClientMessage(Color.error, "Рядом нет грузовика Barracks (433).");
    return;
  }

  const truckId = liveVehicleId(truck);
  if (truckId === null) {
    return;
  }

  ensureTruck(truckId, truck);
  const cargo = trucks.get(truckId);
  if (!cargo || cargo.crates <= 0) {
    player.sendClientMessage(Color.error, "В грузовике нет ящиков.");
    return;
  }

  cargo.crates -= 1;
  updateTruckLabel(truckId, cargo);

  if (!giveCrate(player)) {
    cargo.crates += 1;
    updateTruckLabel(truckId, cargo);
    player.sendClientMessage(Color.error, "Не удалось взять ящик. Попробуйте ещё раз.");
    return;
  }

  carrying.set(id, { source: truckId, dropOrgId: null });

  player.sendClientMessage(
    Color.info,
    `Ящик в руках. В кузове осталось: ${cargo.crates}/${MAX_CRATES}.`
  );
}

function returnCarried(player: Player, message: string | null): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const carry = carrying.get(id);
  if (!carry) {
    return;
  }

  carrying.delete(id);
  atDrop.delete(id);
  clearCrate(player);
  try {
    Checkpoint.disable(player);
  } catch {
    // Ок.
  }

  // Смерть / выход / посадка: патроны всегда обратно на склад Армии.
  addWarehouseAmmo(ORG_ARMY_ID, AMMO_PER_CRATE);
  refreshArmyAmmoStockLabel();

  if (message && isPlayerActive(player)) {
    player.sendClientMessage(Color.gray, message);
  }
}

function onTruckRespawn(vehicle: Vehicle): void {
  try {
    if (vehicle.getModel() !== TRUCK_MODEL) {
      return;
    }
  } catch {
    return;
  }

  const id = liveVehicleId(vehicle);
  if (id === null || !trucks.has(id)) {
    return;
  }

  const cargo = trucks.get(id);
  if (cargo && cargo.crates > 0) {
    addWarehouseAmmo(ORG_ARMY_ID, cargo.crates * AMMO_PER_CRATE);
    refreshArmyAmmoStockLabel();
  }

  if (cargo) {
    destroyLabel(cargo.label);
  }

  trucks.set(id, { crates: 0, label: null });
}

function ensureTruck(truckId: number, _vehicle: Vehicle): void {
  if (trucks.has(truckId)) {
    return;
  }

  trucks.set(truckId, { crates: 0, label: null });
}

function attachTruckLabel(vehicle: Vehicle, truckId: number): void {
  const cargo = trucks.get(truckId);
  if (!cargo || cargo.crates <= 0) {
    if (cargo) {
      destroyLabel(cargo.label);
      cargo.label = null;
    }
    return;
  }

  destroyLabel(cargo.label);
  cargo.label = null;

  try {
    const pos = vehicle.getPos();
    const label = new TextLabel(
      cratesLabelText(cargo.crates),
      LABEL_COLOR,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );
    label.attachToVehicle(vehicle, 0, 0, LABEL_OFFSET_Z);
    cargo.label = label;
  } catch {
    cargo.label = null;
  }
}

function updateTruckLabel(truckId: number, cargo: TruckCargo): void {
  if (cargo.crates <= 0) {
    destroyLabel(cargo.label);
    cargo.label = null;
    return;
  }

  if (!cargo.label) {
    const vehicle = omp.vehicles.at(truckId);
    if (vehicle) {
      attachTruckLabel(vehicle, truckId);
    }
    return;
  }

  try {
    cargo.label.updateText(LABEL_COLOR, cratesLabelText(cargo.crates));
  } catch {
    cargo.label = null;
    const vehicle = omp.vehicles.at(truckId);
    if (vehicle) {
      attachTruckLabel(vehicle, truckId);
    }
  }
}

function cratesLabelText(crates: number): string {
  return `Загружено ящиков: ${crates}`;
}

function destroyLabel(label: TextLabel | null): void {
  if (!label) {
    return;
  }

  try {
    label.destroy();
  } catch {
    // Уже уничтожен.
  }
}

function giveCrate(player: Player): boolean {
  clearCrate(player);
  try {
    player.setAttachedObject(
      SLOT_CRATE,
      CRATE_MODEL,
      1,
      -0.073,
      0.358,
      -0.032,
      0,
      88,
      0,
      1,
      1,
      1,
      0,
      0
    );
    player.setSpecialAction(SPECIAL_ACTION_CARRY);
    return true;
  } catch {
    return false;
  }
}

function clearCrate(player: Player): void {
  try {
    player.removeAttachedObject(SLOT_CRATE);
  } catch {
    // Слота не было.
  }

  try {
    player.setSpecialAction(SPECIAL_ACTION_NONE);
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Игрок уже вышел.
  }
}

function nearestArmyTruck(player: Player, range: number): Vehicle | null {
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
      if (vehicle.getModel() !== TRUCK_MODEL) {
        continue;
      }
      const dist = vehicle.getDistanceFromPoint(x, y, z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = vehicle;
      }
    } catch {
      // Уничтожен.
    }
  }

  return best;
}

function nearestDrop(player: Player): DropPoint | null {
  try {
    const pos = player.getPos();
    let best: DropPoint | null = null;
    let bestDist = DROP_DETECT_RADIUS;
    for (const drop of DROP_POINTS) {
      const dist = Math.hypot(pos.x - drop.x, pos.y - drop.y, pos.z - drop.z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = drop;
      }
    }
    return best;
  } catch {
    return null;
  }
}

function isNearPoint(
  player: Player,
  point: { x: number; y: number; z: number },
  range: number
): boolean {
  try {
    const pos = player.getPos();
    return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= range;
  } catch {
    return false;
  }
}

function isArmyMember(player: Player): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  return membership?.org.id === ORG_ARMY_ID;
}

function refreshDestLabel(orgId: number): void {
  if (orgId === ORG_POLICE_ID) {
    refreshPoliceAmmoStockLabel();
    return;
  }
  if (orgId === ORG_LSPD_ID) {
    refreshLspdAmmoStockLabel();
    return;
  }
  if (orgId === ORG_FBI_ID) {
    refreshFbiAmmoStockLabel();
  }
}

function payPlayer(player: Player, amount: number): void {
  const account = getAccount(player);
  if (!account || amount <= 0) {
    return;
  }

  patchAccount(player, { money: account.money + amount });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  carrying.delete(id);
  atStock.delete(id);
  atDrop.delete(id);
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    return id === INVALID_VEHICLE_ID ? null : id;
  } catch {
    return null;
  }
}
