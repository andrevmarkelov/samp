import {
  Checkpoint,
  Dialog,
  INVALID_VEHICLE_ID,
  omp,
  TextLabel,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated, patchAccount, applyWallet } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { ORG_HOSPITAL_ID, getMembership } from "../org";
import {
  HOSPITAL_MEDS_STOCK_POINT,
  refreshHospitalMedsStockLabel,
} from "../org/hospital-stock";
import { queueSave } from "../persist";
import { STREET_WORLD } from "../spawn/point";
import { addWarehouseMeds } from "../warehouse";
import { registerOrgVehicle } from "./access";
import { createServerVehicle } from "./spawn";

export const HOSPITAL_MED_DELIVERY_DIALOG_ID = 62;

const RESPAWN_SEC = 100;
const DENY = "Вы не состоите в больнице.";
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const DIALOG_STYLE_MSGBOX = 0;
const CHECKPOINT_RADIUS = 4;
const LABEL_DRAW_DISTANCE = 40;
const LABEL_OFFSET_Z = 2.35;
/** Время автоматической загрузки на складе поставщика. */
const LOAD_SEC = 12;
const LOAD_TICK_MS = 1000;
/** Сколько медикаментов грузится за один рейс. */
const LOAD_AMOUNT = 50;
/** В одной коробке при разгрузке. */
const BOX_AMOUNT = 10;
/** Оплата за сдачу одной коробки на склад. */
const PAY_PER_BOX = 40;
const PICK_RANGE = 6;
const STOCK_RADIUS = 1.8;
const TICK_MS = 200;
const ANIM_SYNC_ALL = 1;
const SPECIAL_ACTION_NONE = 0;
const SPECIAL_ACTION_CARRY = 25;
const SLOT_BOX = 1;
const BOX_MODEL = 1580;

const LABEL_TITLE = "{FFFFFF}Доставка {FF0000}лекарств";

const MED_VAN = {
  model: 428,
  x: 1148.1321,
  y: -1304.3973,
  z: 13.8071,
  angle: 359.7076,
  color1: 1,
  color2: 3,
} as const;

/** Склад поставщика — сюда едем за грузом. */
const LOAD_POINT = {
  x: 1351.3651,
  y: 355.8297,
  z: 20.1462,
} as const;

/** Парковка фургона у больницы — сюда возвращаемся после загрузки. */
const RETURN_POINT = {
  x: MED_VAN.x,
  y: MED_VAN.y,
  z: MED_VAN.z,
} as const;
/** Фургон считается на базе, если в этом радиусе от парковки. */
const PARK_RANGE = 18;
/** Допуск к чекпоинту загрузки/возврата (не чужой CP). */
const CP_VERIFY_RANGE = 12;

const HOSPITAL_VEHICLES: ReadonlyArray<{
  model: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  color1: number;
  color2: number;
}> = [
  { model: 416, x: 1178.4301, y: -1338.7181, z: 14.0219, angle: 270.9369, color1: 1, color2: 3 },
  { model: 416, x: 1177.8186, y: -1308.4728, z: 14.0036, angle: 269.4774, color1: 1, color2: 3 },
  { model: 416, x: 1123.9796, y: -1329.4818, z: 13.3585, angle: 0.0023, color1: 1, color2: 3 },
  { model: 416, x: 1110.9613, y: -1329.5452, z: 13.3534, angle: 1.2558, color1: 1, color2: 3 },
  { model: 416, x: 1097.9508, y: -1329.6621, z: 13.3435, angle: 0.5626, color1: 1, color2: 3 },
  { model: 487, x: 1160.7632, y: -1312.3269, z: 31.672, angle: 269.5352, color1: 1, color2: 3 },
  { model: 490, x: 1134.9924, y: -1341.257, z: 13.8918, angle: 0.1497, color1: 3, color2: 1 },
  { model: 490, x: 1139.4137, y: -1341.215, z: 13.8255, angle: 0.764, color1: 3, color2: 1 },
];

type DeliveryPhase = "toLoad" | "loading" | "returning";

type DeliveryJob = {
  phase: DeliveryPhase;
  loadLeft: number;
  loadTimer: ReturnType<typeof setInterval> | null;
};

let medVanId: number | null = null;
let medVanLabel: TextLabel | null = null;
/** Текущий груз фургона (ед. медикаментов). */
let vanMeds = 0;
const offerPending = new Set<number>();
const jobs = new Map<number, DeliveryJob>();
/** Игрок несёт коробку: сколько ед. в руках. */
const carrying = new Map<number, number>();
const atStock = new Set<number>();

export function isHospitalMedDeliveryActive(player: Player): boolean {
  const id = playerId(player);
  return id !== null && (jobs.has(id) || carrying.has(id));
}

export function spawnHospitalVehicles(): void {
  for (const spot of HOSPITAL_VEHICLES) {
    const vehicle = createServerVehicle({
      model: spot.model,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: spot.angle,
      color1: spot.color1,
      color2: spot.color2,
      respawnSec: RESPAWN_SEC,
      world: STREET_WORLD,
    });
    if (vehicle) {
      registerOrgVehicle(vehicle, ORG_HOSPITAL_ID, DENY);
    }
  }

  const medVan = createServerVehicle({
    model: MED_VAN.model,
    x: MED_VAN.x,
    y: MED_VAN.y,
    z: MED_VAN.z,
    angle: MED_VAN.angle,
    color1: MED_VAN.color1,
    color2: MED_VAN.color2,
    respawnSec: RESPAWN_SEC,
    world: STREET_WORLD,
  });
  if (medVan) {
    registerOrgVehicle(medVan, ORG_HOSPITAL_ID, DENY);
    bindMedVan(medVan);
  }

  bindMedDelivery();
}

function bindMedVan(vehicle: Vehicle): void {
  const id = liveVehicleId(vehicle);
  if (id === null) {
    setTimeout(() => bindMedVan(vehicle), 0);
    return;
  }

  medVanId = id;
  vanMeds = 0;
  attachMedVanLabel(vehicle);
}

function bindMedDelivery(): void {
  registerCommand("pickmed", "Взять коробку медикаментов из фургона", (player) => {
    onPickMed(player);
  });

  setInterval(tickUnload, TICK_MS);

  omp.on("vehicleSpawn", (vehicle) => {
    const id = liveVehicleId(vehicle);
    if (id === null || id !== medVanId) {
      return;
    }

    abortAllDeliveryJobs("Фургон доставки был зареспавнен. Рейс отменён.");
    vanMeds = 0;
    attachMedVanLabel(vehicle);
  });

  omp.on("playerStateChange", (player, newState) => {
    if (newState !== PLAYER_STATE_DRIVER) {
      const id = playerId(player);
      if (id !== null) {
        const job = jobs.get(id);
        if (job?.phase === "loading") {
          cancelLoading(player, id, "Загрузка прервана: вы покинули фургон.");
        }
      }
      return;
    }

    const id = playerId(player);
    if (id !== null && carrying.has(id)) {
      returnCarriedToVan(player, id, "Вы сели в транспорт — коробка возвращена в фургон.");
    }

    tryOfferDelivery(player);
  });

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== HOSPITAL_MED_DELIVERY_DIALOG_ID) {
      return;
    }

    onOfferResponse(player, Number(response) !== 0);
  });

  omp.on("playerEnterCheckpoint", (player) => {
    onDeliveryCheckpoint(player);
  });

  omp.on("playerDeath", (player) => {
    const id = playerId(player);
    if (id !== null && carrying.has(id)) {
      returnCarriedToVan(player, id, "Вы потеряли коробку — медикаменты возвращены в фургон.");
    }
  });

  omp.on("playerDisconnect", (player) => {
    clearPlayerDelivery(player);
  });
}

function attachMedVanLabel(vehicle: Vehicle): void {
  destroyMedVanLabel();

  try {
    const pos = vehicle.getPos();
    const label = new TextLabel(
      medsLabelText(vanMeds),
      Color.white,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );
    label.attachToVehicle(vehicle, 0, 0, LABEL_OFFSET_Z);
    medVanLabel = label;
  } catch {
    medVanLabel = null;
  }
}

function destroyMedVanLabel(): void {
  if (!medVanLabel) {
    return;
  }

  try {
    medVanLabel.destroy();
  } catch {
    // Уже уничтожен.
  }

  medVanLabel = null;
}

function updateMedVanLabel(text: string): void {
  if (!medVanLabel) {
    return;
  }

  try {
    medVanLabel.updateText(Color.white, text);
  } catch {
    medVanLabel = null;
  }
}

function medsLabelText(meds: number, loading = false): string {
  if (loading) {
    return `${LABEL_TITLE}\n{FFAA00}Загрузка: ${meds}/${LOAD_AMOUNT}`;
  }

  if (meds <= 0) {
    return `${LABEL_TITLE}\n{FFAA00}Медикаменты: 0`;
  }

  return `${LABEL_TITLE}\n{33CC66}Медикаменты: ${meds}`;
}

function loadedAmountForTick(loadLeft: number): number {
  const elapsed = LOAD_SEC - loadLeft;
  return Math.min(LOAD_AMOUNT, Math.floor((LOAD_AMOUNT * elapsed) / LOAD_SEC));
}

function tryOfferDelivery(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null || jobs.has(id) || offerPending.has(id) || carrying.has(id)) {
    return;
  }

  // Один рейс на фургон: иначе второй курьер залипает с чекпоинтом.
  if (jobs.size > 0 || offerPending.size > 0) {
    return;
  }

  if (vanMeds > 0) {
    return;
  }

  if (!isInMedVanAsDriver(player)) {
    return;
  }

  if (!isHospitalMember(player)) {
    return;
  }

  offerPending.add(id);
  try {
    Dialog.show(
      player,
      HOSPITAL_MED_DELIVERY_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Доставка лекарств",
      `Фургон пуст. Загрузить ${LOAD_AMOUNT} ед. медикаментов у поставщика?\n` +
        `После возврата разгружайте коробками по ${BOX_AMOUNT} ед. (/pickmed).`,
      "Принять",
      "Отмена"
    );
  } catch {
    offerPending.delete(id);
  }
}

function onOfferResponse(player: Player, accepted: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  offerPending.delete(id);

  if (!accepted) {
    ejectFromVehicle(player);
    return;
  }

  if (!isInMedVanAsDriver(player)) {
    player.sendClientMessage(Color.error, "Вы должны быть за рулём фургона доставки.");
    return;
  }

  if (vanMeds > 0) {
    player.sendClientMessage(
      Color.error,
      `Фургон уже загружен (${vanMeds} ед.). Сначала разгрузите его.`
    );
    return;
  }

  if (jobs.size > 0) {
    player.sendClientMessage(Color.error, "Фургон уже занят другим рейсом.");
    return;
  }

  jobs.set(id, { phase: "toLoad", loadLeft: 0, loadTimer: null });
  try {
    Checkpoint.set(player, LOAD_POINT.x, LOAD_POINT.y, LOAD_POINT.z, CHECKPOINT_RADIUS);
    player.sendClientMessage(
      Color.info,
      `Доставка начата. Заберите ${LOAD_AMOUNT} ед. медикаментов у поставщика.`
    );
  } catch {
    jobs.delete(id);
    player.sendClientMessage(Color.error, "Не удалось поставить чекпоинт.");
  }
}

function onDeliveryCheckpoint(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const job = jobs.get(id);
  if (!job) {
    return;
  }

  if (job.phase === "toLoad") {
    if (!isNearPoint(player, LOAD_POINT, CP_VERIFY_RANGE)) {
      return;
    }
    startLoading(player, id, job);
    return;
  }

  if (job.phase === "returning") {
    if (!isNearPoint(player, RETURN_POINT, CP_VERIFY_RANGE)) {
      return;
    }
    finishReturn(player, id);
  }
}

function startLoading(player: Player, id: number, job: DeliveryJob): void {
  if (!isInMedVanAsDriver(player)) {
    player.sendClientMessage(Color.error, "Загрузка только из фургона доставки.");
    return;
  }

  if (job.phase !== "toLoad") {
    return;
  }

  if (vanMeds > 0) {
    jobs.delete(id);
    try {
      Checkpoint.disable(player);
    } catch {
      // Уже снят.
    }
    player.sendClientMessage(
      Color.error,
      "Фургон уже загружен. Ваш рейс к поставщику отменён."
    );
    return;
  }

  try {
    Checkpoint.disable(player);
  } catch {
    // Уже снят.
  }

  vanMeds = 0;
  job.phase = "loading";
  job.loadLeft = LOAD_SEC;
  updateMedVanLabel(medsLabelText(0, true));

  try {
    player.toggleControllable(false);
  } catch {
    cancelLoading(player, id, "Не удалось начать загрузку.");
    return;
  }

  player.sendClientMessage(
    Color.info,
    `Идёт загрузка ${LOAD_AMOUNT} ед. медикаментов. Оставайтесь в фургоне (${LOAD_SEC} сек.).`
  );

  if (job.loadTimer) {
    clearInterval(job.loadTimer);
  }

  job.loadTimer = setInterval(() => {
    tickLoading(player, id);
  }, LOAD_TICK_MS);
}

function tickLoading(player: Player, expectedId: number): void {
  const id = playerId(player);
  if (id === null || id !== expectedId) {
    return;
  }

  const job = jobs.get(id);
  if (!job || job.phase !== "loading") {
    return;
  }

  if (!isPlayerActive(player) || !isInMedVanAsDriver(player)) {
    cancelLoading(player, id, "Загрузка прервана: вы покинули фургон.");
    return;
  }

  job.loadLeft -= 1;
  if (job.loadLeft > 0) {
    vanMeds = loadedAmountForTick(job.loadLeft);
    updateMedVanLabel(medsLabelText(vanMeds, true));
    return;
  }

  finishLoading(player, id, job);
}

function finishLoading(player: Player, id: number, job: DeliveryJob): void {
  if (job.loadTimer) {
    clearInterval(job.loadTimer);
    job.loadTimer = null;
  }

  vanMeds = LOAD_AMOUNT;
  job.phase = "returning";
  job.loadLeft = 0;
  updateMedVanLabel(medsLabelText(vanMeds));

  try {
    player.toggleControllable(true);
  } catch {
    // Игрок уже вышел.
  }

  if (!isPlayerActive(player)) {
    jobs.delete(id);
    return;
  }

  try {
    Checkpoint.set(
      player,
      RETURN_POINT.x,
      RETURN_POINT.y,
      RETURN_POINT.z,
      CHECKPOINT_RADIUS
    );
    player.sendClientMessage(
      Color.info,
      `Загружено ${vanMeds} ед. медикаментов. Вернитесь к парковке больницы.`
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось поставить чекпоинт возврата.");
  }
}

function finishReturn(player: Player, id: number): void {
  const job = jobs.get(id);
  if (!job || job.phase !== "returning") {
    return;
  }

  jobs.delete(id);

  try {
    Checkpoint.disable(player);
  } catch {
    // Уже снят.
  }

  const boxes = Math.ceil(vanMeds / BOX_AMOUNT);
  player.sendClientMessage(
    Color.info,
    `Вы на парковке. В фургоне ${vanMeds} ед. — ${boxes} коробок по ${BOX_AMOUNT}.`
  );
  player.sendClientMessage(
    Color.info,
    "Выйдите из машины, возьмите коробку: /pickmed и отнесите на склад в служебном блоке."
  );
}

function onPickMed(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (!isHospitalMember(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  if (carrying.has(id)) {
    player.sendClientMessage(Color.error, "У вас уже есть коробка. Отнесите её на склад.");
    return;
  }

  if (vanMeds <= 0) {
    player.sendClientMessage(Color.error, "В фургоне нет медикаментов.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Выйдите из транспорта, чтобы взять коробку.");
      return;
    }
  } catch {
    return;
  }

  if (!isNearMedVan(player)) {
    player.sendClientMessage(Color.error, "Подойдите ближе к фургону доставки.");
    return;
  }

  if (!isMedVanAtHospitalParking()) {
    player.sendClientMessage(
      Color.error,
      "Разгрузка только на парковке больницы. Сначала верните фургон на базу."
    );
    return;
  }

  const take = Math.min(BOX_AMOUNT, vanMeds);
  vanMeds -= take;
  updateMedVanLabel(medsLabelText(vanMeds));

  try {
    giveBox(player);
  } catch {
    vanMeds += take;
    updateMedVanLabel(medsLabelText(vanMeds));
    player.sendClientMessage(Color.error, "Не удалось взять коробку.");
    return;
  }

  carrying.set(id, take);
  player.sendClientMessage(
    Color.info,
    `Вы взяли коробку (${take} ед.). Отнесите её на склад медикаментов в служебном блоке.`
  );
  if (vanMeds > 0) {
    player.sendClientMessage(
      Color.gray,
      `В фургоне осталось ${vanMeds} ед. После сдачи возьмите следующую: /pickmed.`
    );
  }
}

function tickUnload(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null || !carrying.has(id)) {
      if (id !== null) {
        atStock.delete(id);
      }
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        atStock.delete(id);
        return;
      }

      if (player.getVirtualWorld() !== HOSPITAL_MEDS_STOCK_POINT.world) {
        atStock.delete(id);
        return;
      }

      const pos = player.getPos();
      const dist = Math.hypot(
        pos.x - HOSPITAL_MEDS_STOCK_POINT.x,
        pos.y - HOSPITAL_MEDS_STOCK_POINT.y,
        pos.z - HOSPITAL_MEDS_STOCK_POINT.z
      );
      if (dist > STOCK_RADIUS) {
        atStock.delete(id);
        return;
      }

      if (atStock.has(id)) {
        return;
      }

      atStock.add(id);
      depositBox(player, id);
    } catch {
      // Игрок уже вышел.
    }
  });
}

function depositBox(player: Player, id: number): void {
  const amount = carrying.get(id);
  if (!amount || amount <= 0) {
    return;
  }

  carrying.delete(id);
  clearBox(player);

  const total = addWarehouseMeds(ORG_HOSPITAL_ID, amount);
  refreshHospitalMedsStockLabel();

  const pay =
    amount >= BOX_AMOUNT
      ? PAY_PER_BOX
      : Math.max(1, Math.floor((PAY_PER_BOX * amount) / BOX_AMOUNT));
  const account = getAccount(player);
  if (account && pay > 0) {
    patchAccount(player, { money: account.money + pay });
    const updated = getAccount(player);
    if (updated) {
      applyWallet(player, updated);
    }
    queueSave(player);
  }

  player.sendClientMessage(
    Color.info,
    `Сдано ${amount} ед. медикаментов. +$${pay}. На складе больницы: ${total}.`
  );

  if (vanMeds > 0) {
    player.sendClientMessage(
      Color.info,
      `В фургоне ещё ${vanMeds} ед. Вернитесь и возьмите коробку: /pickmed.`
    );
    return;
  }

  player.sendClientMessage(Color.info, "Фургон пуст. Доставка медикаментов завершена.");
}

function returnCarriedToVan(player: Player, id: number, message: string): void {
  const amount = carrying.get(id);
  if (!amount) {
    return;
  }

  carrying.delete(id);
  atStock.delete(id);
  vanMeds += amount;
  updateMedVanLabel(medsLabelText(vanMeds));
  clearBox(player);

  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.error, message);
  }
}

function giveBox(player: Player): void {
  clearBox(player);
  player.setAttachedObject(
    SLOT_BOX,
    BOX_MODEL,
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
}

function clearBox(player: Player): void {
  try {
    player.removeAttachedObject(SLOT_BOX);
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

function cancelLoading(player: Player, id: number, message: string): void {
  const job = jobs.get(id);
  if (job?.loadTimer) {
    clearInterval(job.loadTimer);
    job.loadTimer = null;
  }

  const wasLoading = job?.phase === "loading";
  jobs.delete(id);

  if (wasLoading) {
    vanMeds = 0;
    updateMedVanLabel(medsLabelText(0));
  }

  try {
    player.toggleControllable(true);
    Checkpoint.disable(player);
  } catch {
    // Игрок уже вышел.
  }

  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.error, message);
  }
}

function abortAllDeliveryJobs(message: string): void {
  for (const [id, job] of [...jobs.entries()]) {
    if (job.loadTimer) {
      clearInterval(job.loadTimer);
      job.loadTimer = null;
    }

    jobs.delete(id);
    const player = omp.players.at(id);
    if (!player) {
      continue;
    }

    try {
      player.toggleControllable(true);
      Checkpoint.disable(player);
      player.sendClientMessage(Color.error, message);
    } catch {
      // Игрок уже вышел.
    }
  }
}

function clearPlayerDelivery(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  offerPending.delete(id);
  atStock.delete(id);

  if (carrying.has(id)) {
    const amount = carrying.get(id) ?? 0;
    carrying.delete(id);
    vanMeds += amount;
    updateMedVanLabel(medsLabelText(vanMeds));
    clearBox(player);
  }

  const job = jobs.get(id);
  if (!job) {
    return;
  }

  if (job.loadTimer) {
    clearInterval(job.loadTimer);
    job.loadTimer = null;
  }

  const wasLoading = job.phase === "loading";
  jobs.delete(id);

  if (wasLoading) {
    vanMeds = 0;
    updateMedVanLabel(medsLabelText(0));
  }

  try {
    player.toggleControllable(true);
    Checkpoint.disable(player);
  } catch {
    // Игрок уже вышел.
  }
}

function isHospitalMember(player: Player): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  return membership?.org.id === ORG_HOSPITAL_ID;
}

function isNearMedVan(player: Player): boolean {
  if (medVanId === null) {
    return false;
  }

  try {
    const vehicle = omp.vehicles.at(medVanId);
    if (!vehicle) {
      return false;
    }

    const pos = player.getPos();
    const vpos = vehicle.getPos();
    return Math.hypot(pos.x - vpos.x, pos.y - vpos.y, pos.z - vpos.z) <= PICK_RANGE;
  } catch {
    return false;
  }
}

function isMedVanAtHospitalParking(): boolean {
  if (medVanId === null) {
    return false;
  }

  try {
    const vehicle = omp.vehicles.at(medVanId);
    if (!vehicle) {
      return false;
    }

    const vpos = vehicle.getPos();
    return (
      Math.hypot(vpos.x - RETURN_POINT.x, vpos.y - RETURN_POINT.y, vpos.z - RETURN_POINT.z) <=
      PARK_RANGE
    );
  } catch {
    return false;
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

function isInMedVanAsDriver(player: Player): boolean {
  if (medVanId === null) {
    return false;
  }

  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return false;
    }

    return player.getVehicleID() === medVanId;
  } catch {
    return false;
  }
}

function ejectFromVehicle(player: Player): void {
  try {
    player.removeFromVehicle();
    player.sendClientMessage(Color.gray, "Вы отказались от доставки.");
  } catch {
    // Уже не в машине.
  }
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    return id === INVALID_VEHICLE_ID ? null : id;
  } catch {
    return null;
  }
}
