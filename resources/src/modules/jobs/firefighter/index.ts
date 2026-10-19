import {
  Checkpoint,
  Dialog,
  omp,
  Pickup,
  PlayerObject,
  TextLabel,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { grantWeapon, replaceTrustedWeapon, revokeWeapon } from "../../anticheat/trust";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../../auth/session";
import { registerCommand } from "../../commands/registry";
import { isCuffed } from "../../cuff";
import { queueSave } from "../../persist";
import { resolvePlayerSkin } from "../../org/appearance";
import { STREET_WORLD } from "../../spawn/point";
import { districtNameAt } from "../../zones/district";
import { chatColorTag, Color } from "../../../shared/colors";
import { formatMoney } from "../../../shared/money";
import { isPlayerActive, playerId } from "../../../shared/player";
import { syncOrgVehicleAccess, setJobVehicleCrewOnly, setJobVehicleGate } from "../../vehicles/access";
import { addExtraEngineBlocker } from "../../vehicles/fuel";
import { setLightToggleSkip, setVehicleEngine } from "../../vehicles/spawn";
import { JOB_FIREFIGHTER } from "../catalog";
import { firefighterShiftSlots, isFirefighterOnShift, setFirefighterShiftActive } from "./active";
import { bindFireStationDoors, FIRE_STATION_INTERIOR, FIRE_STATION_WORLD } from "./doors";
import {
  bindFireTruckWater,
  fireTruckId,
  getTruckWater,
  isFireTruck,
  isFireTruckId,
  MAX_TRUCK_WATER,
  setTruckWater,
  spawnFireTrucks,
} from "./trucks";

export const FIRE_SHIFT_DIALOG_ID = 169;

const DIALOG_STYLE_MSGBOX = 0;
const PICKUP_TYPE = 1;
const LOCKER_MODEL = 1275;
const EXTINGUISHER_MODEL = 2690;
const EXTINGUISHER_WEAPON = 42;
const WEAPON_SLOT_SPRAY = 9;
/** Один баллон: хватает потушить один пожар с руки и чуть остаётся. */
const MAX_CHARGES = 400;
const CHARGE_PER_TICK = 8;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const KEY_CROUCH = 2;
const KEY_FIRE = 4;
const PICKUP_RADIUS = 1.6;
const HYDRANT_RADIUS = 7;
const ARRIVE_RADIUS = 8;
const TRUCK_RANGE = 18;
const EXTINGUISHER_RANGE = 6;
const TICK_MS = 200;
const SPRAY_MS = 500;
const CALL_MS = 1000;
const OFFER_MS = 5 * 60 * 1000;
const ACCEPT_MS = 30 * 1000;
const TRAVEL_MS = 5 * 60 * 1000;
const REFILL_MS = 7000;
const FLAME_HP = 100;
const FLAME_DAMAGE = 10;
const WATER_PER_TICK = 10;
const FLAME_COUNT = 3;
const SALARY = 2000;
const MAX_CASH = 2_147_483_647;
const LABEL_DRAW = 14;
const MAP_ICON_SLOT = 12;
const MAP_ICON_TYPE = 20;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const FLAME_Z_DROP = 1;
const FIRE_DRAW = 80;
const SKINS = [277, 278, 279] as const;
const FIRE_MODELS = [18688, 18689, 18690, 18691, 18692] as const;
const EMPTY_NOTE_MS = 4000;

const LOCKER = { x: -272.7912, y: 893.4398, z: -36.824 };
const EXTINGUISHER_POINT = { x: -281.7685, y: 893.6332, z: -36.8241 };
const HYDRANT = { x: 1709.1606, y: -1461.5944, z: 13.7817 };
const STATION_ICON = { x: 1739.8669, y: -1460.9817, z: 13.5029 };

const SITES = [
  { x: 1504.8428, y: -2285.7534, z: 13.5469 },
  { x: 2598.9443, y: -2195.8147, z: 13.5469 },
  { x: 312.5999, y: -1772.0974, z: 4.6243 },
  { x: 2431.6089, y: -1017.2999, z: 54.3438 },
  { x: 2244.0044, y: -1410.0651, z: 24 },
  { x: 1448.7904, y: -1150.7236, z: 24.0451 },
  { x: 863.1139, y: -1255.9368, z: 14.7958 },
  { x: 455.0948, y: -1295.2328, z: 15.2946 },
  { x: 1198.9799, y: -1025.7623, z: 32.4865 },
  { x: 290.4441, y: -186.4059, z: 1.5781 },
  { x: 248.6505, y: -17.9907, z: 1.7604 },
  { x: 1334.3495, y: 369.2801, z: 19.5547 },
  { x: 1216.37, y: 306.2447, z: 19.5527 },
  { x: 2337.1753, y: 26.7789, z: 26.4844 },
  { x: 2549.2661, y: 15.1773, z: 26.9964 },
] as const;

type Flame = {
  hp: number;
  x: number;
  y: number;
  z: number;
  object: PlayerObject;
};

type ActiveCall = {
  slot: number;
  siteIndex: number;
  flames: Flame[];
  arrived: boolean;
  arriveBy: number;
  checkpoint: boolean;
};

type PendingCall = {
  siteIndex: number;
  expiresAt: number;
};

type Refill = {
  token: number;
  vehicleId: number;
};

const lockerLock = new Set<number>();
const extinguisherLock = new Set<number>();
/** Какое действие подтверждает открытый диалог смены. Второй ответ его не переключает. */
const shiftDialogIntent = new Map<number, "start" | "end">();
const heldKeys = new Map<number, number>();
const calls = new Map<number, ActiveCall>();
const refills = new Map<number, Refill>();
const emptyNotedAt = new Map<number, number>();
const extinguisherNotedAt = new Map<number, number>();
const iconShown = new Set<number>();

let pending: PendingCall | null = null;
let nextOfferAt = 0;
let refillSerial = 0;
let bound = false;

export function bindFirefighter(): void {
  if (bound) {
    return;
  }
  bound = true;

  nextOfferAt = Date.now() + OFFER_MS;

  new Pickup(LOCKER_MODEL, PICKUP_TYPE, LOCKER.x, LOCKER.y, LOCKER.z, FIRE_STATION_WORLD);
  new Pickup(
    EXTINGUISHER_MODEL,
    PICKUP_TYPE,
    EXTINGUISHER_POINT.x,
    EXTINGUISHER_POINT.y,
    EXTINGUISHER_POINT.z,
    FIRE_STATION_WORLD
  );
  new TextLabel(
    "{FF6A00}Пожарная часть\n{FFFFFF}Раздевалка",
    Color.white,
    LOCKER.x,
    LOCKER.y,
    LOCKER.z + 0.9,
    LABEL_DRAW,
    FIRE_STATION_WORLD,
    false
  );
  new TextLabel(
    "{FF6A00}Огнетушители\n{FFFFFF}Пополнить заряды",
    Color.white,
    EXTINGUISHER_POINT.x,
    EXTINGUISHER_POINT.y,
    EXTINGUISHER_POINT.z + 0.85,
    LABEL_DRAW,
    FIRE_STATION_WORLD,
    false
  );
  new TextLabel(
    "{33CCFF}Водозаборная колонка\n{FFFFFF}Сигнал — заполнить бак",
    Color.white,
    HYDRANT.x,
    HYDRANT.y,
    HYDRANT.z + 3.35,
    22,
    STREET_WORLD,
    false
  );

  setJobVehicleGate(JOB_FIREFIGHTER, (player) => {
    if (!isFirefighterOnShift(player)) {
      return "Сначала начните смену в раздевалке пожарной части.";
    }
    return null;
  });
  setJobVehicleCrewOnly(JOB_FIREFIGHTER, true);
  setLightToggleSkip((vehicle) => isFireTruck(vehicle));
  addExtraEngineBlocker((player) => {
    const slot = playerId(player);
    if (slot !== null && refills.has(slot)) {
      return "Идёт заполнение бака. Подождите.";
    }
    return null;
  });

  bindFireTruckWater();
  spawnFireTrucks();
  bindFireStationDoors();

  registerCommand("fire", "Принять вызов пожара", (player) => {
    acceptCall(player);
  });
  registerCommand("unfire", "Отменить принятый вызов пожара", (player) => {
    cancelOwnCall(player);
  });

  setInterval(tickPickups, TICK_MS);
  setInterval(tickSpray, SPRAY_MS);
  setInterval(tickCalls, CALL_MS);

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== FIRE_SHIFT_DIALOG_ID) {
      return;
    }
    const slot = playerId(player);
    const intent = slot !== null ? shiftDialogIntent.get(slot) : undefined;
    if (slot !== null) {
      shiftDialogIntent.delete(slot);
    }
    if (Number(response) === 0 || intent === undefined) {
      return;
    }
    onShiftDialog(player, intent);
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    const next = Number(newKeys);
    heldKeys.set(slot, next);
    const pressed = next & ~Number(oldKeys);
    if ((pressed & KEY_CROUCH) !== 0) {
      tryRefill(player);
    }
  });

  omp.on("playerShotMissed", (player, weapon) => onShot(player, Number(weapon)));
  omp.on("playerShotPlayer", (player, _target, weapon) => onShot(player, Number(weapon)));
  omp.on("playerShotVehicle", (player, _target, weapon) => onShot(player, Number(weapon)));
  omp.on("playerShotObject", (player, _target, weapon) => onShot(player, Number(weapon)));
  omp.on("playerShotPlayerObject", (player, _target, weapon) =>
    onShot(player, Number(weapon))
  );

  omp.on("playerDeath", (player) => {
    const slot = playerId(player);
    if (slot !== null) {
      heldKeys.delete(slot);
    }
    endShift(player, "Смена прервана.");
  });

  omp.on("playerDisconnect", (player) => {
    endShift(player, null);
    const slot = playerId(player);
    if (slot !== null) {
      lockerLock.delete(slot);
      extinguisherLock.delete(slot);
      heldKeys.delete(slot);
      emptyNotedAt.delete(slot);
      extinguisherNotedAt.delete(slot);
      iconShown.delete(slot);
      shiftDialogIntent.delete(slot);
    }
  });

  omp.on("playerConnect", (player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }
    if (isFirefighterOnShift(player)) {
      endShift(player, null);
    }
    lockerLock.delete(slot);
    extinguisherLock.delete(slot);
    heldKeys.delete(slot);
    iconShown.delete(slot);
    shiftDialogIntent.delete(slot);
  });

  omp.on("vehicleSpawn", (vehicle) => {
    const id = vehicleRuntimeId(vehicle);
    if (id === null || !isFireTruckId(id)) {
      return;
    }
    for (const [slot, refill] of refills) {
      if (refill.vehicleId !== id) {
        continue;
      }
      const player = omp.players.at(slot);
      if (player) {
        abortRefill(player);
      } else {
        refills.delete(slot);
      }
    }
  });
}

export function endFirefighterShift(player: Player): void {
  endShift(player, "Смена прервана.");
}

function updateStationIcon(
  player: Player,
  slot: number,
  x: number,
  y: number,
  world: number,
  interior: number
): void {
  const nearIcon =
    world === STREET_WORLD &&
    interior === 0 &&
    Math.hypot(x - STATION_ICON.x, y - STATION_ICON.y) <= ICON_RADIUS;

  if (nearIcon) {
    if (iconShown.has(slot)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        STATION_ICON.x,
        STATION_ICON.y,
        STATION_ICON.z,
        MAP_ICON_TYPE,
        0,
        MAPICON_LOCAL
      );
      iconShown.add(slot);
    } catch {
      // Игрок уже вышел.
    }
    return;
  }

  if (!iconShown.has(slot)) {
    return;
  }

  try {
    player.removeMapIcon(MAP_ICON_SLOT);
  } catch {
    // Игрок уже вышел.
  }
  iconShown.delete(slot);
}

function tickPickups(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    let onFoot = false;
    let world = -1;
    let interior = -1;
    let pos = { x: 0, y: 0, z: 0 };
    try {
      onFoot = player.getState() === PLAYER_STATE_ONFOOT;
      world = player.getVirtualWorld();
      interior = player.getInterior();
      pos = player.getPos();
    } catch {
      return;
    }

    updateStationIcon(player, slot, pos.x, pos.y, world, interior);

    const atLocker =
      onFoot &&
      world === FIRE_STATION_WORLD &&
      interior === FIRE_STATION_INTERIOR &&
      near(pos, LOCKER, PICKUP_RADIUS);
    if (!atLocker) {
      lockerLock.delete(slot);
    } else if (!lockerLock.has(slot)) {
      lockerLock.add(slot);
      offerLocker(player);
    }

    const atExtinguisher =
      onFoot &&
      world === FIRE_STATION_WORLD &&
      interior === FIRE_STATION_INTERIOR &&
      near(pos, EXTINGUISHER_POINT, PICKUP_RADIUS);
    if (!atExtinguisher) {
      extinguisherLock.delete(slot);
    } else if (!extinguisherLock.has(slot)) {
      extinguisherLock.add(slot);
      offerExtinguisher(player);
    }
  });
}

function offerLocker(player: Player): void {
  const account = getAccount(player);
  if (!account || account.jobId !== JOB_FIREFIGHTER) {
    tell(player, Color.error, "Раздевалка пожарной части. Устроиться можно в мэрии, с 3 уровня.");
    return;
  }

  if (account.jailSeconds > 0) {
    tell(player, Color.error, "В тюрьме работать нельзя.");
    return;
  }

  if (account.hospitalized) {
    tell(player, Color.error, "Вам нужно лечение. Займите койку: /hospital.");
    return;
  }

  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках работать нельзя.");
    return;
  }

  const onShift = isFirefighterOnShift(player);
  const slot = playerId(player);
  if (slot !== null) {
    shiftDialogIntent.set(slot, onShift ? "end" : "start");
  }
  try {
    Dialog.show(
      player,
      FIRE_SHIFT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "{FF6A00}Пожарная часть",
      onShift
        ? "{FFFFFF}Завершить смену? Форма будет сдана.\nАктивный вызов сгорит без оплаты."
        : "{FFFFFF}Начать смену пожарного?\nВам выдадут форму.",
      onShift ? "Завершить" : "Начать",
      "Отмена"
    );
  } catch {
    const slot = playerId(player);
    if (slot !== null) {
      lockerLock.delete(slot);
      shiftDialogIntent.delete(slot);
    }
  }
}

function onShiftDialog(player: Player, intent: "start" | "end"): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  const slot = playerId(player);
  if (!account || slot === null || account.jobId !== JOB_FIREFIGHTER) {
    return;
  }

  if (!isOnFootAt(player, LOCKER, PICKUP_RADIUS + 0.4)) {
    tell(player, Color.error, "Подойдите к раздевалке.");
    return;
  }

  if (intent === "end") {
    if (!isFirefighterOnShift(player)) {
      return;
    }

    const hadCall = calls.has(slot);
    endShift(player, null);
    tell(
      player,
      Color.info,
      hadCall
        ? "Смена закончена. Вызов сгорел, оплата не начислена."
        : "Смена закончена. Форма сдана."
    );
    return;
  }

  if (isFirefighterOnShift(player)) {
    return;
  }

  if (account.jailSeconds > 0 || account.hospitalized || isCuffed(player)) {
    tell(player, Color.error, "Сейчас начать смену нельзя.");
    return;
  }

  const skin = SKINS[Math.floor(Math.random() * SKINS.length)] ?? SKINS[0];
  try {
    player.setSkin(skin);
  } catch {
    tell(player, Color.error, "Не удалось выдать форму.");
    return;
  }

  setFirefighterShiftActive(slot, true);
  try {
    syncOrgVehicleAccess(player);
  } catch {
    // Двери догонятся при посадке.
  }

  tell(
    player,
    Color.info,
    "Смена начата. Машины у боксов, воду заливают у водозаборной колонки сигналом. Вызов: /fire."
  );
}

function offerExtinguisher(player: Player): void {
  const account = getAccount(player);
  if (!account || account.jobId !== JOB_FIREFIGHTER) {
    tell(player, Color.error, "Огнетушители только для пожарных.");
    return;
  }

  if (!isFirefighterOnShift(player)) {
    tell(player, Color.error, "Огнетушитель выдают только на смене.");
    return;
  }

  const ammo = extinguisherAmmo(player);
  if (ammo >= MAX_CHARGES) {
    tell(player, Color.error, "Огнетушитель уже полный.");
    return;
  }

  try {
    player.removeWeapon(EXTINGUISHER_WEAPON);
  } catch {
    // Слота могло не быть.
  }

  if (!grantWeapon(player, EXTINGUISHER_WEAPON, MAX_CHARGES)) {
    tell(player, Color.error, "Не удалось выдать огнетушитель.");
    return;
  }

  replaceTrustedWeapon(player, EXTINGUISHER_WEAPON, MAX_CHARGES);
  try {
    player.setAmmo(EXTINGUISHER_WEAPON, MAX_CHARGES);
    player.setArmedWeapon(EXTINGUISHER_WEAPON);
  } catch {
    // Патроны уже выданы giveWeapon.
  }

  const slot = playerId(player);
  if (slot !== null) {
    extinguisherNotedAt.delete(slot);
  }
  tell(player, Color.info, `Огнетушитель заряжен: ${MAX_CHARGES} зарядов.`);
}

function tryRefill(player: Player): void {
  if (!isFirefighterOnShift(player)) {
    return;
  }

  const slot = playerId(player);
  if (slot === null || refills.has(slot)) {
    return;
  }

  let vehicle: Vehicle | null = null;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return;
    }
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return;
    }
    vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return;
  }

  if (!vehicle || !isFireTruck(vehicle)) {
    return;
  }

  const vehicleId = fireTruckId(vehicle);
  if (vehicleId === null) {
    return;
  }

  let pos = { x: 0, y: 0, z: 0 };
  try {
    pos = vehicle.getPos();
  } catch {
    return;
  }

  if (!near(pos, HYDRANT, HYDRANT_RADIUS)) {
    return;
  }

  if (getTruckWater(vehicleId) >= MAX_TRUCK_WATER) {
    tell(player, Color.error, "Бак уже полный.");
    return;
  }

  const token = ++refillSerial;
  refills.set(slot, { token, vehicleId });
  setVehicleEngine(vehicle, false, false);
  setControllable(player, false);
  tell(player, Color.info, "Колонка подключена. Бак заполняется...");

  setTimeout(() => finishRefill(player, token, vehicleId), REFILL_MS);
}

function finishRefill(player: Player, token: number, vehicleId: number): void {
  const slot = playerId(player);
  const refill = slot !== null ? refills.get(slot) : undefined;
  if (!refill || refill.token !== token) {
    return;
  }

  refills.delete(slot!);
  setControllable(player, true);

  if (!isPlayerActive(player) || !isFirefighterOnShift(player)) {
    return;
  }

  let current: Vehicle | null = null;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return;
    }
    current = omp.vehicles.at(player.getVehicleID()) ?? null;
    if (!current || fireTruckId(current) !== vehicleId) {
      return;
    }
    const pos = current.getPos();
    if (!near(pos, HYDRANT, HYDRANT_RADIUS + 2)) {
      tell(player, Color.error, "Машина уехала от колонки. Бак не заполнен.");
      return;
    }
  } catch {
    return;
  }

  if (!current) {
    return;
  }

  setTruckWater(vehicleId, MAX_TRUCK_WATER);
  setVehicleEngine(current, true, true);
  tell(player, Color.tryOk, `Бак заполнен: ${MAX_TRUCK_WATER} л. Хватит на три пожара.`);
}

function abortRefill(player: Player): void {
  const slot = playerId(player);
  if (slot === null || !refills.has(slot)) {
    return;
  }
  refills.delete(slot);
  setControllable(player, true);
}

function tickCalls(): void {
  const now = Date.now();

  if (pending && now >= pending.expiresAt) {
    pending = null;
    tellShift(Color.gray, "Вызов сгорел: никто не принял его за 30 секунд.");
  }

  for (const call of [...calls.values()]) {
    const player = omp.players.at(call.slot);
    if (!player || !isPlayerActive(player) || !isFirefighterOnShift(player)) {
      if (player) {
        clearCall(call, player);
      } else {
        destroyFlames(call);
        calls.delete(call.slot);
      }
      continue;
    }

    if (!call.arrived && isOnFootOrDrivingNear(player, SITES[call.siteIndex]!, ARRIVE_RADIUS)) {
      call.arrived = true;
      if (call.checkpoint) {
        try {
          Checkpoint.disable(player);
        } catch {
          // Слот пустой.
        }
        call.checkpoint = false;
      }
      tell(player, Color.info, "Вы на месте. Тушите огонь водой из машины или огнетушителем.");
    }

    if (!call.arrived && now >= call.arriveBy) {
      clearCall(call, player);
      tell(player, Color.error, "Вы не успели доехать. Другие расчёты прибыли раньше.");
    }
  }

  if (now < nextOfferAt || pending) {
    return;
  }

  if (firefighterShiftSlots().length === 0) {
    return;
  }

  const free = freeSiteIndexes();
  if (free.length === 0) {
    nextOfferAt = now + OFFER_MS;
    return;
  }

  const siteIndex = free[Math.floor(Math.random() * free.length)] ?? free[0]!;
  pending = { siteIndex, expiresAt: now + ACCEPT_MS };
  nextOfferAt = now + OFFER_MS;
  const site = SITES[siteIndex]!;
  const district = districtNameAt(site.x, site.y);
  tellShift(
    Color.white,
    `${chatColorTag(0xff6a00ff)}[Диспетчер]: ${chatColorTag(Color.white)}В районе «${district}» пожар. ${chatColorTag(0xffd27aff)}30 секунд${chatColorTag(Color.white)}, чтобы принять: ${chatColorTag(0x33ff33ff)}/fire`
  );
}

function acceptCall(player: Player): void {
  if (!isAuthedShift(player)) {
    tell(player, Color.error, "Команда доступна на смене пожарного.");
    return;
  }

  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  if (calls.has(slot)) {
    tell(player, Color.error, "Вы уже на вызове. Отменить: /unfire.");
    return;
  }

  if (!pending) {
    tell(player, Color.info, "Пожаров пока нет.");
    return;
  }

  const offered = pending;
  const siteIndex = offered.siteIndex;
  pending = null;
  const site = SITES[siteIndex]!;
  const district = districtNameAt(site.x, site.y);
  const call: ActiveCall = {
    slot,
    siteIndex,
    flames: [],
    arrived: false,
    arriveBy: Date.now() + TRAVEL_MS,
    checkpoint: false,
  };

  if (!spawnFlames(player, call, site)) {
    if (pending === null && offered.expiresAt > Date.now()) {
      pending = offered;
    }
    tell(player, Color.error, "Не удалось создать очаг. Вызов снова доступен.");
    return;
  }

  calls.set(slot, call);
  try {
    Checkpoint.set(player, site.x, site.y, site.z, ARRIVE_RADIUS);
    call.checkpoint = true;
  } catch {
    call.checkpoint = false;
  }

  tell(
    player,
    Color.info,
    `Вызов принят: «${district}». Красная метка на радаре. У вас 5 минут. Отказаться: /unfire.`
  );
  const account = getAccount(player);
  const who = account ? `${account.name}[${slot}]` : "сотрудник";
  tellShift(Color.info, `Пожарный ${who} принял вызов в районе ${district}.`);
}

function cancelOwnCall(player: Player): void {
  if (!isAuthedShift(player)) {
    tell(player, Color.error, "Команда доступна на смене пожарного.");
    return;
  }

  const slot = playerId(player);
  const call = slot !== null ? calls.get(slot) : undefined;
  if (!call) {
    tell(player, Color.info, "У вас нет активного вызова.");
    return;
  }

  clearCall(call, player);
  tell(player, Color.info, "Вызов отменён. Пожар списан, оплата не начислена.");
}

function tickSpray(): void {
  for (const call of [...calls.values()]) {
    if (!call.arrived || call.flames.length === 0) {
      continue;
    }

    const player = omp.players.at(call.slot);
    if (!player || !isFirefighterOnShift(player)) {
      continue;
    }

    const keys = heldKeys.get(call.slot) ?? 0;
    if ((keys & KEY_FIRE) === 0) {
      continue;
    }

    try {
      if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
        continue;
      }

      const state = player.getState();
      if (state === PLAYER_STATE_DRIVER) {
        sprayFromTruck(player, call);
      } else if (state === PLAYER_STATE_ONFOOT && player.getWeapon() === EXTINGUISHER_WEAPON) {
        sprayFromHand(player, call);
      }
    } catch {
      // Слот пустой.
    }
  }
}

function sprayFromTruck(player: Player, call: ActiveCall): void {
  let vehicle: Vehicle | null = null;
  try {
    vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return;
  }

  const id = vehicle ? fireTruckId(vehicle) : null;
  if (id === null) {
    return;
  }

  const water = getTruckWater(id);
  if (water <= 0) {
    return;
  }

  const flame = nearestFlame(player, call, TRUCK_RANGE);
  if (!flame) {
    return;
  }

  const spend = Math.min(WATER_PER_TICK, water);
  setTruckWater(id, water - spend);
  if (damageFlame(call, flame)) {
    finishFire(player, call);
  }
}

function sprayFromHand(player: Player, call: ActiveCall): void {
  const ammo = extinguisherAmmo(player);
  if (ammo <= 0) {
    noteExtinguisherEmpty(player);
    return;
  }

  const flame = nearestFlame(player, call, EXTINGUISHER_RANGE);
  if (!flame) {
    return;
  }

  const next = Math.max(0, ammo - CHARGE_PER_TICK);
  replaceTrustedWeapon(player, EXTINGUISHER_WEAPON, next);
  try {
    player.setAmmo(EXTINGUISHER_WEAPON, next);
  } catch {
    // Патроны уже могли кончиться.
  }

  if (next <= 0) {
    noteExtinguisherEmpty(player);
  }

  if (damageFlame(call, flame)) {
    finishFire(player, call);
  }
}

function onShot(player: Player, weapon: number): boolean | undefined {
  if (weapon !== EXTINGUISHER_WEAPON) {
    return;
  }

  const truck = driverFireTruck(player);
  if (truck) {
    if (getTruckWater(truck.id) <= 0) {
      noteEmptyTank(player);
      return false;
    }
    return;
  }

  const slot = playerId(player);
  const call = slot !== null ? calls.get(slot) : undefined;
  if (!call?.arrived || !nearestFlame(player, call, EXTINGUISHER_RANGE)) {
    return false;
  }

  if (extinguisherAmmo(player) <= 0) {
    noteExtinguisherEmpty(player);
    return false;
  }

  return;
}

function finishFire(player: Player, call: ActiveCall): void {
  clearCall(call, player);
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (account.money + SALARY > MAX_CASH) {
    tell(player, Color.error, "Пожар потушен, но кошелёк полон — зарплата не начислена.");
    return;
  }

  patchAccount(player, { money: account.money + SALARY });
  const updated = getAccount(player);
  if (!updated || updated.id !== account.id) {
    return;
  }

  applyWallet(player, updated);
  queueSave(player);
  tell(
    player,
    Color.tryOk,
    `Пожар потушен. Зарплата: ${formatMoney(SALARY)}. Ждите следующий вызов или завершите смену в раздевалке.`
  );
}

function spawnFlames(
  player: Player,
  call: ActiveCall,
  site: { x: number; y: number; z: number }
): boolean {
  const modelShift = Math.floor(Math.random() * FIRE_MODELS.length);
  try {
    for (let i = 0; i < FLAME_COUNT; i += 1) {
      const angle = (Math.PI * 2 * i) / FLAME_COUNT + (Math.random() - 0.5) * 0.5;
      const dist = 2.1 + Math.random() * 1.3;
      const x = site.x + Math.cos(angle) * dist;
      const y = site.y + Math.sin(angle) * dist;
      const z = site.z - FLAME_Z_DROP;
      const model = FIRE_MODELS[(modelShift + i) % FIRE_MODELS.length] ?? FIRE_MODELS[0];
      const object = new PlayerObject(player, model, x, y, z, 0, 0, 0, FIRE_DRAW);
      call.flames.push({ hp: FLAME_HP, x, y, z, object });
    }
  } catch {
    destroyFlames(call);
    return false;
  }

  return call.flames.length === FLAME_COUNT;
}

function damageFlame(call: ActiveCall, flame: Flame): boolean {
  flame.hp -= FLAME_DAMAGE;
  if (flame.hp > 0) {
    return false;
  }

  try {
    flame.object.destroy();
  } catch {
    // Уже снят.
  }
  call.flames = call.flames.filter((item) => item !== flame);
  return call.flames.length === 0;
}

function clearCall(call: ActiveCall, player: Player | null): void {
  calls.delete(call.slot);
  destroyFlames(call);
  if (player && call.checkpoint) {
    try {
      Checkpoint.disable(player);
    } catch {
      // Слот пустой.
    }
  }
}

function destroyFlames(call: ActiveCall): void {
  for (const flame of call.flames) {
    try {
      flame.object.destroy();
    } catch {
      // Уже снят.
    }
  }
  call.flames = [];
}

function endShift(player: Player, notice: string | null): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  heldKeys.delete(slot);
  shiftDialogIntent.delete(slot);
  if (!isFirefighterOnShift(player)) {
    return;
  }

  const call = calls.get(slot);
  if (call) {
    clearCall(call, player);
  }

  abortRefill(player);
  setFirefighterShiftActive(slot, false);

  if (!isPlayerActive(player)) {
    return;
  }

  try {
    revokeWeapon(player, EXTINGUISHER_WEAPON);
  } catch {
    // Уже без оружия.
  }

  const account = getAccount(player);
  if (account) {
    try {
      player.setSkin(resolvePlayerSkin(account));
    } catch {
      // Смерть или выход.
    }
  }

  ejectFromFireTruck(player);

  try {
    syncOrgVehicleAccess(player);
  } catch {
    // Игрок уже вышел.
  }

  if (notice) {
    tell(player, Color.error, notice);
  }
}

function ejectFromFireTruck(player: Player): void {
  try {
    if (!player.isInAnyVehicle()) {
      return;
    }
    const vehicle = omp.vehicles.at(player.getVehicleID());
    if (!vehicle || !isFireTruck(vehicle)) {
      return;
    }
    player.removeFromVehicle();
  } catch {
    // Уже пешком.
  }
}

function freeSiteIndexes(): number[] {
  const used = new Set<number>();
  if (pending) {
    used.add(pending.siteIndex);
  }
  for (const call of calls.values()) {
    used.add(call.siteIndex);
  }
  return SITES.map((_, index) => index).filter((index) => !used.has(index));
}

function nearestFlame(player: Player, call: ActiveCall, range: number): Flame | null {
  let pos: { x: number; y: number; z: number };
  try {
    pos = player.getPos();
  } catch {
    return null;
  }

  let best: Flame | null = null;
  let bestDist = range;
  for (const flame of call.flames) {
    const dist = Math.hypot(pos.x - flame.x, pos.y - flame.y, pos.z - flame.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = flame;
    }
  }
  return best;
}

function driverFireTruck(player: Player): { id: number } | null {
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return null;
    }
    const vehicle = omp.vehicles.at(player.getVehicleID());
    if (!vehicle) {
      return null;
    }
    const id = fireTruckId(vehicle);
    return id === null ? null : { id };
  } catch {
    return null;
  }
}

function extinguisherAmmo(player: Player): number {
  try {
    const data = player.getWeaponData(WEAPON_SLOT_SPRAY) as {
      weaponid?: number;
      weapons?: number;
      weapon?: number;
      ammo?: number;
    };
    const id = Number(data.weaponid ?? data.weapons ?? data.weapon ?? 0);
    if (id !== EXTINGUISHER_WEAPON) {
      return 0;
    }
    return Math.max(0, Math.floor(Number(data.ammo ?? 0)));
  } catch {
    return 0;
  }
}

function noteEmptyTank(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }
  const now = Date.now();
  if (now - (emptyNotedAt.get(slot) ?? 0) < EMPTY_NOTE_MS) {
    return;
  }
  emptyNotedAt.set(slot, now);
  tell(player, Color.error, "В баке нет воды. Заполните его у водозаборной колонки.");
}

function noteExtinguisherEmpty(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }
  const now = Date.now();
  if (now - (extinguisherNotedAt.get(slot) ?? 0) < EMPTY_NOTE_MS) {
    return;
  }
  extinguisherNotedAt.set(slot, now);
  tell(player, Color.error, "Огнетушитель пуст. Пополните его в части.");
}

function tellShift(color: number, text: string): void {
  for (const slot of firefighterShiftSlots()) {
    const player = omp.players.at(slot);
    if (player) {
      tell(player, color, text);
    }
  }
}

function isAuthedShift(player: Player): boolean {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return false;
  }
  const account = getAccount(player);
  return !!account && account.jobId === JOB_FIREFIGHTER && isFirefighterOnShift(player);
}

function isOnFootAt(
  player: Player,
  point: { x: number; y: number; z: number },
  radius: number
): boolean {
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }
    if (
      player.getVirtualWorld() !== FIRE_STATION_WORLD ||
      player.getInterior() !== FIRE_STATION_INTERIOR
    ) {
      return false;
    }
    return near(player.getPos(), point, radius);
  } catch {
    return false;
  }
}

function isOnFootOrDrivingNear(
  player: Player,
  point: { x: number; y: number; z: number },
  radius: number
): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }
    const state = player.getState();
    if (
      state !== PLAYER_STATE_ONFOOT &&
      state !== PLAYER_STATE_DRIVER &&
      state !== PLAYER_STATE_PASSENGER
    ) {
      return false;
    }
    return near(player.getPos(), point, radius);
  } catch {
    return false;
  }
}

function near(
  pos: { x: number; y: number; z: number },
  point: { x: number; y: number; z: number },
  radius: number
): boolean {
  return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= radius;
}

function vehicleRuntimeId(vehicle: Vehicle): number | null {
  try {
    const id = Number(vehicle.getID());
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function setControllable(player: Player, enabled: boolean): void {
  try {
    player.toggleControllable(enabled);
  } catch {
    // Слот пуст.
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (!isPlayerActive(player)) {
      return;
    }
    player.sendClientMessage(color, text);
  } catch {
    // Уже вышел.
  }
}
