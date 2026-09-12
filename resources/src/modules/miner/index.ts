import { Checkpoint, Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { queueSave } from "../persist";
import type { GameModule } from "../types";
import { STREET_WORLD } from "../spawn/point";
import { DROP_POINT, HIRE_POINT, INFO_POINT, MAP_ICON_POINT, MINE_POINTS } from "./points";

export const MINER_HIRE_DIALOG_ID = 8;
export const MINER_QUIT_DIALOG_ID = 9;
export const MINER_INFO_DIALOG_ID = 10;

const PICKUP_MODEL = 1275;
const INFO_PICKUP_MODEL = 1239;
const PICKUP_TYPE = 1;
const PICKUP_RADIUS = 1.6;
const CHECKPOINT_RADIUS = 1.8;
const LABEL_HEIGHT = 0.9;
const LABEL_DRAW_DISTANCE = 18;
const TICK_MS = 200;
const MINE_MS = 5500;
const PICKUP_ROCKS_MS = 3000;
const SPECIAL_CHANCE = 0.03;
const KEY_JUMP = 32;
const KEY_FIRE = 4;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const ANIM_SYNC_ALL = 1;
const SPECIAL_ACTION_NONE = 0;
const SLOT_PICKAXE = 1;
const SLOT_CART = 2;
const SLOT_STONE = 3;
const PICKAXE_MODEL = 18634;
const CART_MODEL = 1458;
const ROCK_LEFT_MODEL = 905;
const ROCK_RIGHT_MODEL = 906;
const STONE_MODEL = 905;
const SKIN_MALE = 16;
const SKIN_FEMALE = 191;
const DIALOG_STYLE_MSGBOX = 0;
const MAP_ICON_SLOT = 3;
const MAP_ICON_TYPE = 11;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;

type Phase = "mine" | "dig" | "pickup" | "haul";

type Job = {
  phase: Phase;
  mineIndex: number;
  salary: number;
  kg: number;
};

const jobs = new Map<number, Job>();
const digTimers = new Map<number, ReturnType<typeof setTimeout>>();
const standingOnHire = new Set<number>();
const standingOnInfo = new Set<number>();
const iconShown = new Set<number>();

export function isMinerLocked(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  return jobs.get(id)?.phase === "dig" || jobs.get(id)?.phase === "pickup";
}

export function isMinerOnShift(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  return jobs.has(id);
}

export const minerModule: GameModule = {
  name: "miner",
  start() {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      HIRE_POINT.x,
      HIRE_POINT.y,
      HIRE_POINT.z,
      STREET_WORLD
    );

    new TextLabel(
      "Shakhta\nRabota shakhtera",
      Color.info,
      HIRE_POINT.x,
      HIRE_POINT.y,
      HIRE_POINT.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    new TextLabel(
      "Shakhta\nInformatsiya",
      Color.info,
      INFO_POINT.x,
      INFO_POINT.y,
      INFO_POINT.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    new Pickup(
      INFO_PICKUP_MODEL,
      PICKUP_TYPE,
      INFO_POINT.x,
      INFO_POINT.y,
      INFO_POINT.z,
      STREET_WORLD
    );

    setInterval(tickMiner, TICK_MS);

    omp.on("playerConnect", (player) => {
      forgetSlot(player);
    });

    omp.on("dialogResponse", (player, dialogId, response) => {
      const id = Number(dialogId);
      const ok = Number(response) !== 0;

      if (id === MINER_HIRE_DIALOG_ID) {
        if (ok) {
          hire(player);
        }
        return;
      }

      if (id === MINER_QUIT_DIALOG_ID && ok) {
        finishShift(player);
      }
    });

    omp.on("playerEnterCheckpoint", (player) => {
      onCheckpoint(player);
    });

    omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
      const pressed = newKeys & ~oldKeys;
      if ((pressed & KEY_JUMP) !== 0 || (pressed & KEY_FIRE) !== 0) {
        loseLoad(player);
      }
    });

    omp.on("playerStateChange", (player, newState) => {
      if (newState === PLAYER_STATE_DRIVER || newState === PLAYER_STATE_PASSENGER) {
        loseLoad(player);
      }
    });

    omp.on("playerDeath", (player) => {
      abortShift(player, true);
    });

    omp.on("playerDisconnect", (player) => {
      hideMineIcon(player);
      abortShift(player, false);
      forgetSlot(player);
    });
  },
};

function updateMineIcon(
  player: Player,
  x: number,
  y: number,
  world: number,
  interior: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const near =
    world === STREET_WORLD &&
    interior === 0 &&
    Math.hypot(x - MAP_ICON_POINT.x, y - MAP_ICON_POINT.y) <= ICON_RADIUS;

  if (near) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        MAP_ICON_POINT.x,
        MAP_ICON_POINT.y,
        MAP_ICON_POINT.z,
        MAP_ICON_TYPE,
        0,
        MAPICON_LOCAL
      );
      iconShown.add(id);
    } catch {
      // Игрок уже вышел.
    }
    return;
  }

  if (!iconShown.has(id)) {
    return;
  }

  hideMineIcon(player);
  iconShown.delete(id);
}

function hideMineIcon(player: Player): void {
  try {
    player.removeMapIcon(MAP_ICON_SLOT);
  } catch {
    // Игрок уже вышел.
  }
}

function tickMiner(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    const job = jobs.get(id);

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      updateMineIcon(player, pos.x, pos.y, world, interior);

      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (world !== STREET_WORLD) {
        standingOnHire.delete(id);
        standingOnInfo.delete(id);
        return;
      }

      const hireDist = Math.hypot(
        pos.x - HIRE_POINT.x,
        pos.y - HIRE_POINT.y,
        pos.z - HIRE_POINT.z
      );
      if (hireDist > PICKUP_RADIUS) {
        standingOnHire.delete(id);
      } else if (job?.phase !== "dig" && job?.phase !== "pickup" && !standingOnHire.has(id)) {
        standingOnHire.add(id);
        if (job) {
          showQuitDialog(player, job);
        } else {
          showHireDialog(player);
        }
      }

      const infoDist = Math.hypot(
        pos.x - INFO_POINT.x,
        pos.y - INFO_POINT.y,
        pos.z - INFO_POINT.z
      );
      if (infoDist > PICKUP_RADIUS) {
        standingOnInfo.delete(id);
      } else if (!standingOnInfo.has(id)) {
        standingOnInfo.add(id);
        showInfoDialog(player);
      }
    } catch {
      // Слот уже пуст.
    }
  });
}

function showInfoDialog(player: Player): void {
  try {
    Dialog.show(
      player,
      MINER_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Shakhta",
      [
        "Rabota shakhtera",
        "",
        "Obychnaya ruda: 6-16 kg, $15 za kg",
        "Osobaya ruda: redkiy shans, 3-8 kg, $90 za kg",
        "",
        "Zarplata kopitsya za smenu i vydaetsya",
        "tol'ko kogda vy zavershaete rabotu.",
      ].join("\n"),
      "Zakryt",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' dialog.");
  }
}

function showHireDialog(player: Player): void {
  try {
    Dialog.show(
      player,
      MINER_HIRE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Shakhta",
      "Vy khotite ustroit'sya na rabotu shakhtera?",
      "Da",
      "Net"
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' dialog.");
  }
}

function showQuitDialog(player: Player, job: Job): void {
  try {
    Dialog.show(
      player,
      MINER_QUIT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Shakhta",
      `Zavershit' smenu i poluchit' voznagrazhdenie?\nSeychas: ${job.kg} kg, $${job.salary}`,
      "Da",
      "Net"
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' dialog.");
  }
}

function hire(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  const account = getAccount(player);
  if (id === null || !account) {
    return;
  }

  if (account.hospitalized) {
    player.sendClientMessage(Color.error, "Snachala zakonchite lechenie.");
    return;
  }

  if (!isOnFootAt(player, HIRE_POINT, PICKUP_RADIUS + 0.8)) {
    player.sendClientMessage(Color.error, "Podoydite k mestu ustroystva.");
    return;
  }

  if (jobs.has(id)) {
    return;
  }

  const skin = account.gender === "female" ? SKIN_FEMALE : SKIN_MALE;
  const mineIndex = pickMine();
  const job: Job = {
    phase: "mine",
    mineIndex,
    salary: 0,
    kg: 0,
  };
  jobs.set(id, job);

  try {
    player.setSkin(skin);
    preloadAnims(player);
  } catch {
    abortShift(player, false);
    return;
  }

  givePickaxe(player);
  setMineCheckpoint(player, job);
  player.sendClientMessage(Color.info, "Vy ustroilis' shakhterom. Idite k otmetke i dobyvaite rudu.");
}

function finishShift(player: Player): void {
  const id = playerId(player);
  const account = getAccount(player);
  const job = id !== null ? jobs.get(id) : undefined;
  if (id === null || !account || !job) {
    return;
  }

  if (!isOnFootAt(player, HIRE_POINT, PICKUP_RADIUS + 0.8)) {
    player.sendClientMessage(Color.error, "Podoydite k mestu ustroystva.");
    return;
  }

  const kg = job.kg;
  const salary = job.salary;
  restoreWorker(player, account.skin);
  jobs.delete(id);

  if (salary > 0) {
    patchAccount(player, { money: account.money + salary });
    try {
      player.giveMoney(salary);
    } catch {
      // Слот уже не в мире.
    }
    queueSave(player);
  }

  player.sendClientMessage(
    Color.info,
    `Smena zakonchena. Vy dobyli ${kg} kg rudy i poluchili $${salary}.`
  );
}

function abortShift(player: Player, notify: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (!jobs.has(id)) {
    return;
  }

  const account = getAccount(player);
  restoreWorker(player, account?.skin ?? null);
  jobs.delete(id);

  if (notify && isPlayerActive(player)) {
    player.sendClientMessage(
      Color.error,
      "Smena sorvana. Ruda i zarplata sgoreli."
    );
  }
}

function restoreWorker(player: Player, skin: number | null): void {
  const id = playerId(player);
  if (id !== null) {
    const timer = digTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      digTimers.delete(id);
    }
  }

  try {
    player.toggleControllable(true);
    resetStance(player);
    clearJobObjects(player);
    Checkpoint.disable(player);
    if (skin !== null) {
      player.setSkin(skin);
    }
  } catch {
    // Игрок уже вышел.
  }
}

function onCheckpoint(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const job = jobs.get(id);
  if (!job || job.phase === "dig" || job.phase === "pickup") {
    return;
  }

  if (job.phase === "mine") {
    startDig(player, job);
    return;
  }

  if (job.phase === "haul") {
    deliver(player, job);
  }
}

function startDig(player: Player, job: Job): void {
  const id = playerId(player);
  if (id === null || job.phase !== "mine") {
    return;
  }

  const point = MINE_POINTS[job.mineIndex];
  if (!point || !isOnFootAt(player, point, CHECKPOINT_RADIUS + 2)) {
    return;
  }

  job.phase = "dig";
  try {
    Checkpoint.disable(player);
    player.toggleControllable(false);
    playMineAnim(player);
    setTimeout(() => {
      if (jobs.get(id)?.phase === "dig") {
        playMineAnim(player);
      }
    }, 80);
  } catch {
    abortShift(player, true);
    return;
  }

  const prev = digTimers.get(id);
  if (prev) {
    clearTimeout(prev);
  }

  digTimers.set(
    id,
    setTimeout(() => {
      digTimers.delete(id);
      finishDig(player, id);
    }, MINE_MS)
  );
}

function playMineAnim(player: Player): void {
  player.applyAnimation(
    "BASEBALL",
    "Bat_4",
    4.1,
    true,
    false,
    false,
    false,
    0,
    ANIM_SYNC_ALL
  );
}

function preloadAnims(player: Player): void {
  try {
    player.applyAnimation("BASEBALL", "Bat_4", 4.1, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.applyAnimation("PED", "IDLE_chat", 4.1, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.applyAnimation("CARRY", "crry_prtial", 4.1, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Библиотека подтянется на первой добыче.
  }
}

function playPickupAnim(player: Player): void {
  player.applyAnimation(
    "PED",
    "IDLE_chat",
    4.1,
    false,
    false,
    false,
    true,
    5150,
    ANIM_SYNC_ALL
  );
}

function resetStance(player: Player): void {
  try {
    player.setSpecialAction(SPECIAL_ACTION_NONE);
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Игрок уже вышел.
  }
}

function finishDig(player: Player, expectedId: number): void {
  if (!isPlayerActive(player) || playerId(player) !== expectedId) {
    return;
  }

  const job = jobs.get(expectedId);
  if (!job || job.phase !== "dig") {
    return;
  }

  job.phase = "pickup";
  try {
    player.toggleControllable(false);
    giveHandsRocks(player);
    playPickupAnim(player);
  } catch {
    abortShift(player, true);
    return;
  }

  digTimers.set(
    expectedId,
    setTimeout(() => {
      digTimers.delete(expectedId);
      finishPickup(player, expectedId);
    }, PICKUP_ROCKS_MS)
  );
}

function finishPickup(player: Player, expectedId: number): void {
  if (!isPlayerActive(player) || playerId(player) !== expectedId) {
    return;
  }

  const job = jobs.get(expectedId);
  if (!job || job.phase !== "pickup") {
    return;
  }

  job.phase = "haul";
  try {
    player.toggleControllable(true);
    resetStance(player);
    giveCart(player);
    Checkpoint.set(player, DROP_POINT.x, DROP_POINT.y, DROP_POINT.z, CHECKPOINT_RADIUS);
  } catch {
    abortShift(player, true);
    return;
  }

  player.sendClientMessage(Color.info, "Ruda v tachechke. Otvezite ee k skladu.");
}

function deliver(player: Player, job: Job): void {
  if (job.phase !== "haul") {
    return;
  }

  if (!isOnFootAt(player, DROP_POINT, CHECKPOINT_RADIUS + 2)) {
    return;
  }

  const special = Math.random() < SPECIAL_CHANCE;
  const kg = special ? randInt(3, 8) : randInt(6, 16);
  const pay = special ? kg * 90 : kg * 15;
  job.kg += kg;
  job.salary += pay;
  job.phase = "mine";
  job.mineIndex = pickMine(job.mineIndex);

  givePickaxe(player);
  setMineCheckpoint(player, job);

  const kind = special ? "osobaya" : "obychnaya";
  player.sendClientMessage(
    Color.info,
    `Sdano: ${kind} ruda, ${kg} kg. +$${pay}`
  );
  player.sendClientMessage(Color.white, `Zarplata za smenu: $${job.salary}`);
}

function loseLoad(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const job = jobs.get(id);
  if (!job || job.phase !== "haul") {
    return;
  }

  job.phase = "mine";
  job.mineIndex = pickMine(job.mineIndex);
  givePickaxe(player);
  setMineCheckpoint(player, job);
  player.sendClientMessage(
    Color.error,
    "Vy slomali telegu. Ruda poteriana, dobyvaite snova."
  );
}

function setMineCheckpoint(player: Player, job: Job): void {
  const point = MINE_POINTS[job.mineIndex] ?? MINE_POINTS[0];
  try {
    Checkpoint.set(player, point.x, point.y, point.z, CHECKPOINT_RADIUS);
  } catch {
    // Игрок уже вышел.
  }
}

function givePickaxe(player: Player): void {
  try {
    resetStance(player);
    clearJobObjects(player);
    player.setAttachedObject(
      SLOT_PICKAXE,
      PICKAXE_MODEL,
      14,
      0.333391,
      0,
      0.042249,
      358.219909,
      268.014739,
      170.032974,
      2.003867,
      1.764811,
      1.579773,
      0,
      0
    );
  } catch {
    // Слот ещё не готов.
  }
}

function giveHandsRocks(player: Player): void {
  clearJobObjects(player);
  player.setAttachedObject(
    SLOT_CART,
    ROCK_LEFT_MODEL,
    5,
    0.020944,
    0.039285,
    -0.03501,
    0,
    0,
    0,
    0.301603,
    0.125763,
    0.233199,
    0,
    0
  );
  player.setAttachedObject(
    SLOT_STONE,
    ROCK_RIGHT_MODEL,
    6,
    -0.032336,
    0.111448,
    0.001745,
    0,
    0,
    0,
    0.026124,
    0.048238,
    0.048593,
    0,
    0
  );
}

function giveCart(player: Player): void {
  try {
    clearJobObjects(player);
    player.setAttachedObject(
      SLOT_CART,
      CART_MODEL,
      1,
      -1.034844,
      1.116571,
      -0.065124,
      76.480148,
      75.78157,
      280.952545,
      0.575599,
      0.604554,
      0.624122,
      0,
      0
    );
    player.setAttachedObject(
      SLOT_STONE,
      STONE_MODEL,
      1,
      -0.275758,
      1.30528,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      0,
      0
    );
    player.setSpecialAction(SPECIAL_ACTION_NONE);
  } catch {
    // Слот ещё не готов.
  }
}

function clearJobObjects(player: Player): void {
  for (const slot of [SLOT_PICKAXE, SLOT_CART, SLOT_STONE]) {
    try {
      player.removeAttachedObject(slot);
    } catch {
      // Слота не было.
    }
  }
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

    const pos = player.getPos();
    return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= radius;
  } catch {
    return false;
  }
}

function forgetSlot(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const timer = digTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    digTimers.delete(id);
  }

  jobs.delete(id);
  standingOnHire.delete(id);
  standingOnInfo.delete(id);
  iconShown.delete(id);
}

function pickMine(except?: number): number {
  if (MINE_POINTS.length < 2) {
    return 0;
  }

  let index = Math.floor(Math.random() * MINE_POINTS.length);
  if (except === undefined) {
    return index;
  }

  let guard = 0;
  while (index === except && guard < 8) {
    index = Math.floor(Math.random() * MINE_POINTS.length);
    guard += 1;
  }
  return index;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
