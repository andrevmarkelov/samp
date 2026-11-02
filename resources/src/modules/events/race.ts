import { Checkpoint, Dialog, omp, Pickup, RaceCheckpoint, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { clipClientMessage } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { trustPosition } from "../anticheat/trust";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { isCuffed } from "../cuff";
import { queueSave } from "../persist";
import { isJailed } from "../prison/sentence";
import { placeAt, STREET_WORLD, type SpawnPoint } from "../spawn/point";
import { clearVehicleFuel, MAX_VEHICLE_FUEL, setVehicleFuel } from "../vehicles/fuel";
import { createServerVehicle } from "../vehicles/spawn";
import { onEventLeave } from "./commands";
import {
  entertainmentGpsNumber,
  formatClock,
  nextRegistrationOpenFor,
  registerScheduledEvent,
} from "./schedule";
import { isEventParticipant, setEventDisconnectHook, setEventParticipant } from "./state";
import { runStartCountdown } from "./countdown";

export const RACE_REGISTER_DIALOG_ID = 175;
export const RACE_LEAVE_DIALOG_ID = 176;

const DIALOG_STYLE_MSGBOX = 0;
const PICKUP_TYPE = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 400;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const MIN_LEVEL = 3;
const MIN_PLAYERS = 2;
const RACE_WORLD = 23;
const EVENT_NOTICE = 0x00ffa4ff;
const MAX_PLAYERS = 10;
const FEE = 20_000;
const EXIT_MS = 30_000;
const MAX_CASH = 2_147_483_647;
const MODEL_SULTAN = 560;
const PICKUP_MODEL = 1078;
const RESPAWN_SEC = 3_600;
const CP_RADIUS = 12;
const RACE_CP_NORMAL = 0;
const RACE_CP_FINISH = 1;
const TELEPORT_SPEED = 90;
const TELEPORT_SLACK = 50;
const MOVE_GRACE_MS = 2_000;
/** Дальше этого от своей клетки в лобби машину возвращают на старт. */
const GRID_HOLD_M = 15;
const PARAM_ON = 1;
const PARAM_OFF = 0;

/** Доли банка взносов: 1–5 места. Сумма 100, хвост округления уходит последнему из этих мест. */
const PRIZE_WEIGHTS = [34, 24, 18, 14, 10] as const;

/** Нитро x10, спойлер, бамперы, капот, юбки, выхлоп, фары, крыша, диски, музыка, гидравлика. */
const SULTAN_TUNE = [1010, 1001, 1169, 1140, 1142, 1026, 1028, 1013, 1032, 1077, 1086, 1087] as const;

const GPS_POINT = { x: 1444.027, y: -2286.9031, z: 13.5469 } as const;
const PICKUP_POINT = { x: 1451.1675, y: -2287.0564, z: 13.5469 } as const;

const GRID = [
  { x: 1588.8008, y: -1875.0424, z: 13.0469, angle: 90 },
  { x: 1588.8008, y: -1869.85, z: 13.0469, angle: 90 },
  { x: 1596.7949, y: -1875.0424, z: 13.0469, angle: 90 },
  { x: 1596.7949, y: -1869.85, z: 13.0469, angle: 90 },
  { x: 1604.5605, y: -1875.0424, z: 13.0469, angle: 90 },
  { x: 1604.5605, y: -1869.8699, z: 13.0469, angle: 90 },
  { x: 1611.7507, y: -1875.0424, z: 13.0469, angle: 90 },
  { x: 1611.7448, y: -1869.8699, z: 13.0558, angle: 90 },
  { x: 1619.1288, y: -1875.0424, z: 13.0469, angle: 90 },
  { x: 1619.1288, y: -1869.8699, z: 13.0469, angle: 90 },
] as const;

const CHECKPOINTS = [
  { x: 1519.4159, y: -1872.396, z: 13.0871 },
  { x: 1252.1533, y: -1852.3013, z: 13.0875 },
  { x: 1078.1117, y: -1852.2865, z: 13.0951 },
  { x: 1010.5413, y: -1792.92, z: 13.6608 },
  { x: 917.491, y: -1760.248, z: 13.087 },
  { x: 917.5309, y: -1536.0682, z: 13.0875 },
  { x: 917.4017, y: -1343.05, z: 13.0058 },
  { x: 942.3167, y: -1308.025, z: 13.2029 },
  { x: 942.5637, y: -1166.6798, z: 21.8465 },
  { x: 962.6577, y: -1124.3148, z: 23.3771 },
  { x: 962.6522, y: -995.502, z: 36.5892 },
  { x: 906.0181, y: -979.8484, z: 37.3814 },
  { x: 777.0221, y: -1050.4733, z: 24.1026 },
  { x: 654.5444, y: -1195.9791, z: 17.7168 },
  { x: 631.2353, y: -1257.1927, z: 16.8671 },
  { x: 632.3757, y: -1544.4395, z: 14.8761 },
  { x: 607.987, y: -1586.6346, z: 15.7123 },
  { x: 407.5253, y: -1587.7363, z: 26.9137 },
  { x: 259.2142, y: -1574.1613, z: 32.6882 },
  { x: 237.1906, y: -1593.2719, z: 32.7693 },
  { x: 327.4951, y: -1642.7472, z: 32.8226 },
  { x: 369.7485, y: -1668.0826, z: 32.4314 },
  { x: 369.7677, y: -1882.3856, z: 7.37 },
  { x: 369.7794, y: -2037.073, z: 7.3772 },
] as const;

type Phase = "idle" | "registration" | "countdown" | "race";
type DropHow = "return" | "stay" | "jail" | "death";

type Racer = {
  slot: number;
  vehicleId: number;
  cp: number;
  exitAt: number;
  feePaid: boolean;
  name: string;
  lastX: number;
  lastY: number;
  lastZ: number;
  movedAt: number;
  graceUntil: number;
};

const racers = new Map<number, Racer>();
const vehicleOwner = new Map<number, number>();
const onPickup = new Set<number>();
const usedColors = new Set<number>();

const RETURN_POINT: SpawnPoint = {
  x: GPS_POINT.x,
  y: GPS_POINT.y,
  z: GPS_POINT.z,
  angle: 0,
  interior: 0,
  world: STREET_WORLD,
};

let phase: Phase = "idle";
let pot = 0;
let prizes: number[] = [];
let finishCount = 0;
let stopCountdown: (() => void) | null = null;
let bound = false;

export function bindRace(): void {
  if (bound) {
    return;
  }
  bound = true;

  registerScheduledEvent({
    id: "race",
    name: "Гонки",
    parity: "odd",
    openRegistration,
    closeRegistration,
  });
  setEventDisconnectHook(onDisconnect);
  onEventLeave(askLeave);

  new Pickup(PICKUP_MODEL, PICKUP_TYPE, PICKUP_POINT.x, PICKUP_POINT.y, PICKUP_POINT.z, STREET_WORLD);
  setInterval(tickRace, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response) => {
    const id = Number(dialogId);
    const ok = Number(response) !== 0;
    if (id === RACE_REGISTER_DIALOG_ID) {
      if (ok) {
        confirmRegister(player);
      }
      return;
    }
    if (id === RACE_LEAVE_DIALOG_ID && ok) {
      leaveRace(player);
    }
  });

  omp.on("playerDeath", (player) => {
    const racer = racerOf(player);
    if (!racer || phase === "idle") {
      return;
    }
    const id = playerId(player);
    tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
    dropRacer(player, "death", feeReturns());
  });

  omp.on("playerStateChange", (player, newState) => {
    onState(player, Number(newState));
  });

  omp.on("playerEnterRaceCheckpoint", (player) => {
    onCheckpoint(player);
  });

  omp.on("vehicleDeath", (vehicle) => {
    const id = vehicleId(vehicle);
    if (id === null || !vehicleOwner.has(id)) {
      return;
    }
    const ownerId = vehicleOwner.get(id);
    const owner = ownerId === undefined ? undefined : omp.players.at(ownerId);
    const racer = ownerId === undefined ? undefined : racers.get(ownerId);
    if (owner && racer && isPlayerActive(owner)) {
      tell(owner, Color.error, "Машина разбита. Вы выбыли из гонки.");
      tellRacersExcept(ownerId ?? null, `${leftLine(racer)} покинул гонку.`);
      dropRacer(owner, "return", feeReturns());
    } else {
      destroyRaceVehicle(id);
    }
  });
}

function openRegistration(startAt: number): void {
  void startAt;
  if (phase !== "idle") {
    return;
  }
  phase = "registration";
  pot = 0;
  prizes = [];
  finishCount = 0;
  usedColors.clear();
  const item = entertainmentGpsNumber();
  const gps = item > 0 ? String(item) : "Развлечения";
  announce(
    EVENT_NOTICE,
    `Через 10 минут начинаются Гонки. Регистрация на месте {73ACAC}(/gps ${gps})`
  );
}

function closeRegistration(startAt: number): void {
  void startAt;
  if (phase !== "registration") {
    return;
  }
  if (racers.size < MIN_PLAYERS) {
    cancelRegistration();
    return;
  }
  prizes = [];
  finishCount = 0;
  stopCountdown?.();
  stopCountdown = null;
  phase = "countdown";
  for (const [id, racer] of racers) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    putInOwnCar(player, racer);
    setFrozen(player, true);
  }
  tellRacers("Старт через 5 секунд.");
  stopCountdown = runStartCountdown(
    () => phase === "countdown",
    () => {
      const list: Player[] = [];
      for (const id of racers.keys()) {
        const player = omp.players.at(id);
        if (player && isPlayerActive(player)) {
          list.push(player);
        }
      }
      return list;
    },
    releaseRace
  );
}

function releaseRace(): void {
  stopCountdown = null;
  if (phase !== "countdown") {
    return;
  }
  for (const id of [...racers.keys()]) {
    const racer = racers.get(id);
    if (!racer) {
      continue;
    }
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      destroyRaceVehicle(racer.vehicleId);
      racers.delete(id);
      continue;
    }
    if (!inRaceWorld(player)) {
      tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
      dropRacer(player, "stay", true);
      tell(player, Color.info, "Вы сняты с гонки. Взнос возвращён.");
    }
  }
  if (racers.size < MIN_PLAYERS) {
    if (racers.size === 0) {
      pot = 0;
      prizes = [];
      phase = "idle";
      usedColors.clear();
      return;
    }
    cancelRegistration();
    return;
  }
  prizes = splitPot(pot, racers.size);
  pot = 0;
  phase = "race";
  for (const [id, racer] of racers) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    racer.cp = 0;
    racer.exitAt = 0;
    racer.movedAt = Date.now();
    racer.graceUntil = Date.now() + MOVE_GRACE_MS;
    const vehicle = omp.vehicles.at(racer.vehicleId);
    if (vehicle) {
      setEngine(vehicle, true);
    }
    putInOwnCar(player, racer);
    setFrozen(player, false);
    showCheckpoint(player, racer);
  }
  tellRacers("Гонка началась. Проезжайте чекпоинты до финиша. Вышли из машины — 30 секунд, чтобы вернуться.");
}

function cancelRegistration(): void {
  stopCountdown?.();
  stopCountdown = null;
  announce(EVENT_NOTICE, "Мероприятие Гонки отменено: не набралось игроков. Взнос за регистрацию возвращён.");
  for (const id of [...racers.keys()]) {
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      dropRacer(player, "return", true);
    } else {
      const racer = racers.get(id);
      if (racer) {
        destroyRaceVehicle(racer.vehicleId);
      }
      racers.delete(id);
    }
  }
  pot = 0;
  phase = "idle";
  usedColors.clear();
}

function tickRace(): void {
  const now = Date.now();
  for (const id of [...racers.keys()]) {
    const player = omp.players.at(id);
    const racer = racers.get(id);
    if (!racer) {
      continue;
    }
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    if (isJailed(player)) {
      tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
      dropRacer(player, "jail", feeReturns());
      continue;
    }
    if (isCuffed(player)) {
      tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
      dropRacer(player, "stay", feeReturns());
      continue;
    }
    if (phase === "registration" || phase === "countdown") {
      if (!inRaceWorld(player)) {
        tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
        const refund = feeReturns();
        dropRacer(player, "stay", refund);
        tell(
          player,
          Color.info,
          refund ? "Вы сняты с гонки. Взнос возвращён." : "Вы сняты с гонки."
        );
        continue;
      }
      holdOnGrid(player, racer);
      setFrozen(player, true);
      continue;
    }
    if (phase !== "race") {
      continue;
    }
    if (isDrivingOwnCar(player, racer)) {
      racer.exitAt = 0;
    } else if (racer.exitAt === 0) {
      racer.exitAt = now;
      tell(player, Color.error, "Вы вышли из машины. Вернитесь за 30 секунд, иначе выбудете.");
    } else if (now - racer.exitAt >= EXIT_MS) {
      tell(player, Color.error, "Вы не вернулись в машину и выбыли из гонки.");
      tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
      dropRacer(player, "return", false);
      continue;
    }
    if (movedByAdmin(player, racer, now)) {
      tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
      dropRacer(player, "stay", false);
    }
  }

  for (const id of [...onPickup]) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      onPickup.delete(id);
    }
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player) || racerOf(player)) {
      return;
    }
    const id = playerId(player);
    if (id === null) {
      return;
    }
    try {
      if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
        onPickup.delete(id);
        return;
      }
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        onPickup.delete(id);
        return;
      }
      const pos = player.getPos();
      const near =
        Math.hypot(pos.x - PICKUP_POINT.x, pos.y - PICKUP_POINT.y, pos.z - PICKUP_POINT.z) <=
        PICKUP_RADIUS;
      if (!near) {
        onPickup.delete(id);
        return;
      }
      if (onPickup.has(id)) {
        return;
      }
      onPickup.add(id);
      offerRegistration(player);
    } catch {
      // Слот пустой.
    }
  });

  if (phase === "race" && racers.size === 0) {
    phase = "idle";
    prizes = [];
    usedColors.clear();
  }
}

function offerRegistration(player: Player): void {
  if (isEventParticipant(player)) {
    tell(player, Color.error, "Вы уже на мероприятии.");
    return;
  }
  if (phase !== "registration") {
    if (phase === "idle") {
      tell(
        player,
        Color.info,
        `Регистрация на Гонки откроется в ${formatClock(nextRegistrationOpenFor("odd"))}.`
      );
      return;
    }
    tell(player, Color.error, "Регистрация на Гонки уже закрыта.");
    return;
  }
  if (racers.size >= MAX_PLAYERS) {
    tell(player, Color.error, "На Гонки больше нет мест. Максимум 10 игроков.");
    return;
  }
  if (isJailed(player)) {
    tell(player, Color.error, "Из тюрьмы на гонку не попасть.");
    return;
  }
  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках зарегистрироваться нельзя.");
    return;
  }
  const account = getAccount(player);
  if (!account || account.level < MIN_LEVEL) {
    tell(player, Color.error, "На мероприятия пускают с 3 уровня.");
    return;
  }
  if (!account.licenses.car) {
    tell(player, Color.error, "Для гонки нужны права на автомобиль.");
    return;
  }
  try {
    Dialog.show(
      player,
      RACE_REGISTER_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Гонки",
      [
        "Нужно проехать все чекпоинты до финиша.",
        "Призовых мест пять: первое получает больше всех, пятое меньше.",
        "Кто приехал после пятого места, едет без награды.",
        "",
        `Участие с ${MIN_LEVEL} уровня, права на автомобиль, взнос ${formatMoney(FEE)}.`,
        "Если игроков меньше двух, гонку отменят и взнос вернут.",
        "Вышли из машины на трассе — 30 секунд, чтобы вернуться.",
        "До старта можно выйти: /leave.",
        "",
        "Зарегистрироваться?",
      ].join("\n"),
      "Да",
      "Нет"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть регистрацию.");
  }
}

function confirmRegister(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }
  if (phase !== "registration") {
    tell(player, Color.error, "Регистрация уже закрыта.");
    return;
  }
  const id = playerId(player);
  if (id === null || racers.has(id)) {
    tell(player, Color.error, "Вы уже записаны на Гонки.");
    return;
  }
  if (isEventParticipant(player)) {
    tell(player, Color.error, "Вы уже на мероприятии.");
    return;
  }
  if (racers.size >= MAX_PLAYERS) {
    tell(player, Color.error, "На Гонки больше нет мест.");
    return;
  }
  if (isJailed(player) || isCuffed(player) || !atRegistration(player)) {
    tell(player, Color.error, "Подойдите к месту регистрации.");
    return;
  }
  const account = getAccount(player);
  if (!account || account.level < MIN_LEVEL) {
    tell(player, Color.error, "На мероприятия пускают с 3 уровня.");
    return;
  }
  if (!account.licenses.car) {
    tell(player, Color.error, "Для гонки нужны права на автомобиль.");
    return;
  }
  if (account.money < FEE) {
    tell(player, Color.error, `Нужно ${formatMoney(FEE)} наличными.`);
    return;
  }
  const slot = takeSlot();
  const grid = GRID[slot];
  if (!grid) {
    tell(player, Color.error, "На Гонки больше нет мест.");
    return;
  }
  if (!takeFee(player)) {
    tell(player, Color.error, "Не удалось списать взнос.");
    return;
  }

  const colors = nextColors();
  const vehicle = createServerVehicle({
    model: MODEL_SULTAN,
    x: grid.x,
    y: grid.y,
    z: grid.z,
    angle: grid.angle,
    color1: colors.color1,
    color2: colors.color2,
    respawnSec: RESPAWN_SEC,
    world: RACE_WORLD,
  });
  const carId = vehicle ? vehicleId(vehicle) : null;
  if (!vehicle || carId === null) {
    usedColors.delete(colors.color1);
    giveCash(player, FEE);
    tell(player, Color.error, "Не удалось выдать машину. Взнос возвращён.");
    return;
  }

  tuneVehicle(vehicle);
  setVehicleFuel(vehicle, MAX_VEHICLE_FUEL);
  try {
    vehicle.setHealth(1000);
  } catch {
    // Машина уже есть.
  }

  const racer: Racer = {
    slot,
    vehicleId: carId,
    cp: 0,
    exitAt: 0,
    feePaid: true,
    name: playerChatName(player),
    lastX: grid.x,
    lastY: grid.y,
    lastZ: grid.z,
    movedAt: Date.now(),
    graceUntil: Date.now() + MOVE_GRACE_MS,
  };
  pot += FEE;
  racers.set(id, racer);
  vehicleOwner.set(carId, id);
  setEventParticipant(player, true);
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Пешком.
  }
  try {
    placeAt(
      player,
      {
        x: grid.x,
        y: grid.y,
        z: grid.z,
        angle: grid.angle,
        interior: 0,
        world: RACE_WORLD,
      },
      { settleMs: false }
    );
    player.putInVehicle(vehicle, 0);
    Checkpoint.disable(player);
    RaceCheckpoint.disable(player);
  } catch {
    // Посадка повторится на тике.
  }
  trustPosition(player, grid.x, grid.y, grid.z, 0, RACE_WORLD);
  setFrozen(player, true);
  tell(
    player,
    Color.info,
    `Вы на старте ${slot + 1}. Ждите конца регистрации в машине. /leave — выйти и вернуть взнос.`
  );
}

function onCheckpoint(player: Player): void {
  if (phase !== "race") {
    return;
  }
  const racer = racerOf(player);
  if (!racer || !isDrivingOwnCar(player, racer)) {
    return;
  }
  const point = CHECKPOINTS[racer.cp];
  if (!point) {
    return;
  }
  try {
    const pos = player.getPos();
    if (Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) > CP_RADIUS * 2) {
      return;
    }
  } catch {
    return;
  }
  racer.cp += 1;
  if (racer.cp >= CHECKPOINTS.length) {
    finishRacer(player, racer);
    return;
  }
  showCheckpoint(player, racer);
  tell(player, Color.info, `Чекпоинт ${racer.cp} из ${CHECKPOINTS.length}.`);
}

function finishRacer(player: Player, racer: Racer): void {
  const id = playerId(player);
  if (id === null || racers.get(id) !== racer) {
    return;
  }
  finishCount += 1;
  const place = finishCount;
  const prize = prizes[place - 1] ?? 0;
  racer.name = playerChatName(player);
  tellRacers(`[Гонка] Игрок ${racer.name} занял №${place} место.`);
  dropRacer(player, "return", false);
  if (prize > 0) {
    const paid = giveCash(player, prize);
    if (paid > 0) {
      tell(player, Color.tryOk, `Вы заняли ${place} место и получили ${formatMoney(paid)}.`);
      return;
    }
  }
  tell(player, Color.info, `Вы заняли ${place} место. Призовых мест пять, награды нет.`);
}

function askLeave(player: Player): boolean {
  const racer = racerOf(player);
  if (!racer) {
    return false;
  }
  const refund = feeReturns() ? "Взнос вернут." : "Взнос не вернут.";
  try {
    Dialog.show(
      player,
      RACE_LEAVE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Выход",
      `Покинуть Гонки? Вас вернут к месту регистрации. ${refund}`,
      "Выйти",
      "Остаться"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть окно.");
  }
  return true;
}

function leaveRace(player: Player): void {
  const racer = racerOf(player);
  if (!racer) {
    return;
  }
  const refund = feeReturns();
  const id = playerId(player);
  tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
  dropRacer(player, "return", refund);
  tell(
    player,
    Color.info,
    refund ? "Вы покинули Гонки. Взнос возвращён." : "Вы покинули Гонки."
  );
}

function dropRacer(player: Player, how: DropHow, refund: boolean): void {
  const id = playerId(player);
  const racer = id === null ? undefined : racers.get(id);
  if (!racer || id === null) {
    return;
  }
  racers.delete(id);
  onPickup.delete(id);
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }
  destroyRaceVehicle(racer.vehicleId);
  try {
    RaceCheckpoint.disable(player);
  } catch {
    // Метки нет.
  }
  if (refund && racer.feePaid) {
    racer.feePaid = false;
    pot = Math.max(0, pot - FEE);
    giveCash(player, FEE);
  }
  if (how === "death") {
    setTimeout(() => {
      if (!isPlayerActive(player)) {
        setEventParticipant(player, false);
        return;
      }
      try {
        player.spawn();
      } catch {
        // Уже жив.
      }
      sendHome(player);
      setEventParticipant(player, false);
      setFrozen(player, false);
    }, 100);
    if (phase === "race" && racers.size === 0) {
      phase = "idle";
      prizes = [];
      usedColors.clear();
    }
    return;
  }
  if (how === "return") {
    sendHome(player);
  }
  setEventParticipant(player, false);
  if (!isCuffed(player)) {
    setFrozen(player, false);
  }
  if (phase === "race" && racers.size === 0) {
    phase = "idle";
    prizes = [];
    usedColors.clear();
  }
}

function onDisconnect(player: Player): void {
  const id = playerId(player);
  const racer = id === null ? undefined : racers.get(id);
  if (!racer || id === null) {
    return;
  }
  racer.name = playerChatName(player);
  if (feeReturns() && racer.feePaid) {
    const account = getAccount(player);
    if (account) {
      patchAccount(player, { money: Math.min(MAX_CASH, account.money + FEE) });
    }
    pot = Math.max(0, pot - FEE);
    racer.feePaid = false;
  }
  tellRacersExcept(id, `${leftLine(racer)} покинул гонку.`);
  racers.delete(id);
  onPickup.delete(id);
  destroyRaceVehicle(racer.vehicleId);
  if (phase === "race" && racers.size === 0) {
    phase = "idle";
    prizes = [];
    usedColors.clear();
  }
}

function onState(player: Player, state: number): void {
  if (state !== PLAYER_STATE_DRIVER) {
    return;
  }
  const current = vehicleIdOf(player);
  if (current === null || !vehicleOwner.has(current)) {
    return;
  }
  const id = playerId(player);
  if (id === null || vehicleOwner.get(current) === id) {
    return;
  }
  try {
    player.removeFromVehicle();
  } catch {
    // Уже вышел.
  }
  tell(player, Color.error, "Это машина участника гонки.");
}

function showCheckpoint(player: Player, racer: Racer): void {
  const point = CHECKPOINTS[racer.cp];
  const next = CHECKPOINTS[racer.cp + 1] ?? point;
  if (!point || !next) {
    return;
  }
  const last = racer.cp >= CHECKPOINTS.length - 1;
  try {
    Checkpoint.disable(player);
  } catch {
    // Метки нет.
  }
  try {
    RaceCheckpoint.set(
      player,
      last ? RACE_CP_FINISH : RACE_CP_NORMAL,
      point.x,
      point.y,
      point.z,
      next.x,
      next.y,
      next.z,
      CP_RADIUS
    );
  } catch {
    // Игрок уже вышел.
  }
}

function putInOwnCar(player: Player, racer: Racer): void {
  const vehicle = omp.vehicles.at(racer.vehicleId);
  if (!vehicle) {
    return;
  }
  try {
    vehicle.setVirtualWorld(RACE_WORLD);
    if (!isDrivingOwnCar(player, racer)) {
      player.putInVehicle(vehicle, 0);
    }
  } catch {
    // Машина уже занята.
  }
}

function holdOnGrid(player: Player, racer: Racer): void {
  const grid = GRID[racer.slot];
  const vehicle = grid ? omp.vehicles.at(racer.vehicleId) : undefined;
  if (!grid || !vehicle) {
    return;
  }
  let moved = false;
  try {
    const pos = vehicle.getPos();
    moved = Math.hypot(pos.x - grid.x, pos.y - grid.y, pos.z - grid.z) > GRID_HOLD_M;
  } catch {
    moved = true;
  }
  if (moved) {
    trustPosition(player, grid.x, grid.y, grid.z, 0, RACE_WORLD);
    try {
      vehicle.setVirtualWorld(RACE_WORLD);
      vehicle.setPos(grid.x, grid.y, grid.z);
      vehicle.setZAngle(grid.angle);
    } catch {
      // Машина уже удалена.
    }
    racer.lastX = grid.x;
    racer.lastY = grid.y;
    racer.lastZ = grid.z;
    racer.movedAt = Date.now();
  }
  putInOwnCar(player, racer);
}

function inRaceWorld(player: Player): boolean {
  try {
    return player.getVirtualWorld() === RACE_WORLD && player.getInterior() === 0;
  } catch {
    return false;
  }
}

function isDrivingOwnCar(player: Player, racer: Racer): boolean {
  try {
    return player.getState() === PLAYER_STATE_DRIVER && vehicleIdOf(player) === racer.vehicleId;
  } catch {
    return false;
  }
}

function destroyRaceVehicle(id: number): void {
  vehicleOwner.delete(id);
  clearVehicleFuel(id);
  const vehicle = omp.vehicles.at(id);
  if (!vehicle) {
    return;
  }
  try {
    vehicle.destroy();
  } catch {
    // Уже удалена.
  }
}

function tuneVehicle(vehicle: Vehicle): void {
  for (const component of SULTAN_TUNE) {
    try {
      vehicle.addComponent(component);
    } catch {
      // Эта деталь к Sultan не встаёт.
    }
  }
}

function setEngine(vehicle: Vehicle, on: boolean): void {
  try {
    const params = vehicle.getParamsEx();
    vehicle.setParamsEx(
      on ? PARAM_ON : PARAM_OFF,
      on ? PARAM_ON : flag(params.lights),
      flag(params.alarm),
      flag(params.doors),
      flag(params.bonnet),
      flag(params.boot),
      flag(params.objective)
    );
  } catch {
    // Машина уже удалена.
  }
}

function movedByAdmin(player: Player, racer: Racer, now: number): boolean {
  try {
    if (player.getVirtualWorld() !== RACE_WORLD || player.getInterior() !== 0) {
      return true;
    }
    const pos = player.getPos();
    const dt = Math.max(1, now - racer.movedAt);
    const allowed = TELEPORT_SPEED * (dt / 1000) + TELEPORT_SLACK;
    const jumped =
      now >= racer.graceUntil &&
      Math.hypot(pos.x - racer.lastX, pos.y - racer.lastY, pos.z - racer.lastZ) > allowed;
    racer.lastX = pos.x;
    racer.lastY = pos.y;
    racer.lastZ = pos.z;
    racer.movedAt = now;
    return jumped;
  } catch {
    return false;
  }
}

function sendHome(player: Player): void {
  try {
    placeAt(player, RETURN_POINT, { settleMs: false });
  } catch {
    // Уже вышел.
  }
}

function setFrozen(player: Player, frozen: boolean): void {
  if (!frozen && isCuffed(player)) {
    return;
  }
  try {
    player.toggleControllable(!frozen);
  } catch {
    // Уже вышел.
  }
}

function takeSlot(): number {
  const used = new Set([...racers.values()].map((racer) => racer.slot));
  for (let index = 0; index < GRID.length; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return -1;
}

function nextColors(): { color1: number; color2: number } {
  const free: number[] = [];
  for (let color = 0; color < 126; color += 1) {
    if (!usedColors.has(color)) {
      free.push(color);
    }
  }
  const color1 = free[Math.floor(Math.random() * free.length)] ?? 1;
  usedColors.add(color1);
  let color2 = (color1 + 37) % 126;
  if (color2 === color1) {
    color2 = (color1 + 1) % 126;
  }
  return { color1, color2 };
}

function splitPot(amount: number, starters: number): number[] {
  const places = Math.min(PRIZE_WEIGHTS.length, Math.max(0, starters));
  const used = PRIZE_WEIGHTS.slice(0, places);
  const sum = used.reduce((total, weight) => total + weight, 0);
  if (sum <= 0 || amount <= 0) {
    return [];
  }
  const shares: number[] = [];
  let left = amount;
  for (let index = 0; index < used.length; index += 1) {
    const weight = used[index] ?? 0;
    const share = index === used.length - 1 ? left : Math.floor((amount * weight) / sum);
    shares.push(Math.max(0, share));
    left -= share;
  }
  return shares;
}

function feeReturns(): boolean {
  return phase === "registration" || phase === "countdown";
}

function racerOf(player: Player): Racer | undefined {
  const id = playerId(player);
  if (id === null) {
    return undefined;
  }
  return racers.get(id);
}

function vehicleId(vehicle: Vehicle): number | null {
  try {
    const id = Number(vehicle.getID());
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function vehicleIdOf(player: Player): number | null {
  try {
    if (!player.isInAnyVehicle()) {
      return null;
    }
    const id = Number(player.getVehicleID());
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function atRegistration(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }
    const pos = player.getPos();
    return (
      Math.hypot(pos.x - PICKUP_POINT.x, pos.y - PICKUP_POINT.y, pos.z - PICKUP_POINT.z) <=
      PICKUP_RADIUS
    );
  } catch {
    return false;
  }
}

function leftLine(racer: Racer): string {
  return `[Гонки] Игрок ${racer.name}`;
}

function takeFee(player: Player): boolean {
  const account = getAccount(player);
  if (!account || account.money < FEE) {
    return false;
  }
  patchAccount(player, { money: account.money - FEE });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
  return true;
}

function giveCash(player: Player, amount: number): number {
  const account = getAccount(player);
  if (!account || amount <= 0) {
    return 0;
  }
  const next = Math.max(0, Math.min(MAX_CASH, Math.floor(account.money + amount)));
  const paid = next - account.money;
  if (paid <= 0) {
    return 0;
  }
  patchAccount(player, { money: next });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
  return paid;
}

function flag(value: unknown): number {
  return value ? PARAM_ON : PARAM_OFF;
}

function tellRacers(text: string): void {
  const line = clipClientMessage(text);
  for (const id of racers.keys()) {
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      tell(player, Color.info, line);
    }
  }
}

function tellRacersExcept(skipId: number | null, text: string): void {
  const line = clipClientMessage(text);
  for (const id of racers.keys()) {
    if (id === skipId) {
      continue;
    }
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      tell(player, Color.info, line);
    }
  }
}

function announce(color: number, text: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }
    try {
      if (player.isNPC()) {
        return;
      }
    } catch {
      return;
    }
    tell(player, color, text);
  });
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, clipClientMessage(text));
  } catch {
    // Игрок уже вышел.
  }
}
