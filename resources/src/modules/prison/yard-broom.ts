import { omp, Pickup, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { queueSave } from "../persist";
import { isCuffed } from "../cuff";
import { PRISON_YARD_WORLD } from "../spawn/point";
import { isJailed, reduceJailSeconds } from "./sentence";

const BROOM_MODEL = 19622;
const BROOM_SLOT = 4;
/** Кость 5 — левая кисть. */
const BROOM_BONE = 5;
const PICKUP_TYPE = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const SPOT_COOLDOWN_MS = 20_000;
const SPOT_GAP = 2;
const SENTENCE_CUT_SECONDS = 15;
const SWEEP_PAY = 25;
const MAX_CASH = 2_147_483_647;
/** H. */
const KEY_CTRL_BACK = 262144;
const PLAYER_STATE_ONFOOT = 1;
const ANIM_SYNC_ALL = 1;
const ANIM_DELTA = 4.1;
const CLEAN_SPOT_COLOR = 0xcc9966ff;

/** Подход, подметание, завершение и обычная стойка. Взмах — большая часть из 10 секунд. */
const SWEEP_STEPS = [
  { lib: "INT_SHOP", name: "SHOP_CASHIER", ms: 2_000, loop: false, hold: true },
  { lib: "FLAME", name: "FLAME_FIRE", ms: 5_500, loop: true, hold: false },
  { lib: "INT_SHOP", name: "SHOP_OUT", ms: 1_700, loop: false, hold: true },
  { lib: "PED", name: "IDLE_STANCE", ms: 800, loop: true, hold: false },
] as const;
/** Заморозка в том же кадре сбрасывает анимацию, поэтому первый шаг чуть позже. */
const SWEEP_ARM_MS = 300;

const BROOM = {
  x: 1751.3143,
  y: -1544.1498,
  z: 9.4542,
} as const;

type Spot = {
  x: number;
  y: number;
  z: number;
  until: number;
};

type SweepStep = (typeof SWEEP_STEPS)[number];

type Sweep = {
  token: number;
  x: number;
  y: number;
  z: number;
  timers: ReturnType<typeof setTimeout>[];
};

const brooms = new Set<number>();
const onBroomPickup = new Set<number>();
const broomDenied = new Set<number>();
const sweeps = new Map<number, Sweep>();
const spots: Spot[] = [];
let sweepToken = 0;
let bound = false;

export function bindYardBroom(): void {
  if (bound) {
    return;
  }
  bound = true;

  new Pickup(BROOM_MODEL, PICKUP_TYPE, BROOM.x, BROOM.y, BROOM.z, PRISON_YARD_WORLD);

  setInterval(tickYardBroom, TICK_MS);

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_CTRL_BACK) === 0) {
      return;
    }
    tryStartSweep(player);
  });

  omp.on("playerDeath", (player) => {
    takeBroom(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }
    brooms.delete(id);
    onBroomPickup.delete(id);
    broomDenied.delete(id);
    cancelSweep(id);
  });
}

function tickYardBroom(): void {
  const now = Date.now();
  for (let index = spots.length - 1; index >= 0; index -= 1) {
    const spot = spots[index];
    if (spot && spot.until <= now) {
      spots.splice(index, 1);
    }
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    if (brooms.has(id) && !canHoldBroom(player)) {
      takeBroom(player);
    }

    try {
      if (!inYard(player) || player.getState() !== PLAYER_STATE_ONFOOT) {
        onBroomPickup.delete(id);
        broomDenied.delete(id);
        return;
      }

      const pos = player.getPos();
      if (distance3d(pos.x, pos.y, pos.z, BROOM.x, BROOM.y, BROOM.z) > PICKUP_RADIUS) {
        onBroomPickup.delete(id);
        broomDenied.delete(id);
        return;
      }

      if (!isJailed(player)) {
        if (onBroomPickup.has(id)) {
          return;
        }
        if (!broomDenied.has(id)) {
          broomDenied.add(id);
          tell(player, Color.error, "Подметать могут только заключённые.");
        }
        return;
      }
      broomDenied.delete(id);

      if (onBroomPickup.has(id)) {
        return;
      }
      onBroomPickup.add(id);
      onBroomPickupEnter(player);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function onBroomPickupEnter(player: Player): void {
  if (hasBroom(player)) {
    takeBroom(player);
    return;
  }

  giveBroom(player);
}

function giveBroom(player: Player): void {
  const id = playerId(player);
  if (id === null || brooms.has(id)) {
    return;
  }

  let attached = false;
  try {
    attached = player.setAttachedObject(
      BROOM_SLOT,
      BROOM_MODEL,
      BROOM_BONE,
      0.1,
      0.02,
      0,
      0,
      270,
      0,
      1,
      1,
      1,
      0,
      0
    );
  } catch {
    attached = false;
  }

  if (!attached) {
    tell(player, Color.error, "Не удалось взять метлу.");
    return;
  }

  brooms.add(id);
  preloadSweepAnims(player);
  tell(
    player,
    Color.white,
    "Вы начали работу дворника. Нажмите {cc9966}H{FFFFFF}, чтобы начать подметать"
  );
}

function takeBroom(player: Player): void {
  const id = playerId(player);
  if (id === null || !brooms.has(id)) {
    if (id !== null) {
      cancelSweep(id);
    }
    return;
  }

  brooms.delete(id);
  cancelSweep(id);

  try {
    player.removeAttachedObject(BROOM_SLOT);
  } catch {
    // Объект уже снят.
  }

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Анимации уже нет.
  }

  setSweepFrozen(player, false);
}

function tryStartSweep(player: Player): void {
  const id = playerId(player);
  if (id === null || sweeps.has(id) || !hasBroom(player) || !canHoldBroom(player)) {
    return;
  }

  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках подметать нельзя.");
    return;
  }

  let pos: { x: number; y: number; z: number };
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }
    pos = player.getPos();
  } catch {
    return;
  }

  if (spotBlocked(pos.x, pos.y)) {
    tell(player, CLEAN_SPOT_COLOR, "Кажется, здесь всё чисто. Приберитесь в другом месте");
    return;
  }

  const first = SWEEP_STEPS[0];
  if (!first) {
    return;
  }

  const token = ++sweepToken;
  const timers: ReturnType<typeof setTimeout>[] = [];
  timers.push(
    setTimeout(() => {
      if (!isSweepToken(id, token) || !isPlayerActive(player)) {
        return;
      }
      if (!playSweepStep(player, first)) {
        cancelSweep(id);
        setSweepFrozen(player, false);
        tell(player, Color.error, "Не удалось начать подметание.");
      }
    }, SWEEP_ARM_MS)
  );

  let at = SWEEP_ARM_MS + first.ms;
  for (let index = 1; index < SWEEP_STEPS.length; index += 1) {
    const step = SWEEP_STEPS[index];
    if (!step) {
      continue;
    }
    const when = at;
    timers.push(
      setTimeout(() => {
        if (!isSweepToken(id, token) || !isPlayerActive(player)) {
          return;
        }
        playSweepStep(player, step);
      }, when)
    );
    at += step.ms;
  }
  timers.push(setTimeout(() => finishSweep(player, id, token), at));
  sweeps.set(id, { token, x: pos.x, y: pos.y, z: pos.z, timers });
  setSweepFrozen(player, true);
}

function playSweepStep(player: Player, step: SweepStep): boolean {
  try {
    player.applyAnimation(
      step.lib,
      step.name,
      ANIM_DELTA,
      step.loop,
      true,
      true,
      step.hold,
      step.loop ? 0 : step.ms,
      ANIM_SYNC_ALL
    );
    return true;
  } catch {
    return false;
  }
}

function preloadSweepAnims(player: Player): void {
  const id = playerId(player);
  try {
    player.applyAnimation("INT_SHOP", "SHOP_CASHIER", ANIM_DELTA, false, true, true, false, 1, ANIM_SYNC_ALL);
    player.applyAnimation("FLAME", "FLAME_FIRE", ANIM_DELTA, false, true, true, false, 1, ANIM_SYNC_ALL);
    player.applyAnimation("INT_SHOP", "SHOP_OUT", ANIM_DELTA, false, true, true, false, 1, ANIM_SYNC_ALL);
  } catch {
    return;
  }

  // Сразу clearAnimations гасит предзагрузку в том же кадре, и первая анимация не видна.
  setTimeout(() => {
    if (id === null || sweeps.has(id) || !isPlayerActive(player)) {
      return;
    }
    try {
      player.clearAnimations(ANIM_SYNC_ALL);
    } catch {
      // Игрок уже вышел.
    }
  }, 400);
}

function isSweepToken(id: number, token: number): boolean {
  return sweeps.get(id)?.token === token;
}

function finishSweep(player: Player, id: number, token: number): void {
  const sweep = sweeps.get(id);
  if (!sweep || sweep.token !== token) {
    return;
  }
  sweeps.delete(id);

  if (!isPlayerActive(player)) {
    return;
  }

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Анимация уже сброшена.
  }

  setSweepFrozen(player, false);

  if (!hasBroom(player) || !canHoldBroom(player)) {
    return;
  }

  let pos: { x: number; y: number; z: number };
  try {
    pos = player.getPos();
  } catch {
    return;
  }

  if (distance2d(pos.x, pos.y, sweep.x, sweep.y) >= SPOT_GAP) {
    tell(player, Color.error, "Вы отошли, подметание не засчитано.");
    return;
  }

  spots.push({
    x: sweep.x,
    y: sweep.y,
    z: sweep.z,
    until: Date.now() + SPOT_COOLDOWN_MS,
  });

  const paid = paySweep(player);
  const result = reduceJailSeconds(player, SENTENCE_CUT_SECONDS);
  if (result === "reduced") {
    const money = paid > 0 ? ` Получено ${formatMoney(paid)}.` : "";
    tell(player, Color.info, `Вы подмели двор. Срок уменьшен на 15 секунд.${money}`);
    return;
  }
  if (paid > 0) {
    tell(player, Color.info, `Вы подмели двор. Получено ${formatMoney(paid)}.`);
  }
}

function paySweep(player: Player): number {
  const account = getAccount(player);
  if (!account) {
    return 0;
  }

  const next = Math.max(0, Math.min(MAX_CASH, Math.floor(account.money + SWEEP_PAY)));
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

function setSweepFrozen(player: Player, frozen: boolean): void {
  if (!frozen && isCuffed(player)) {
    return;
  }

  try {
    player.toggleControllable(!frozen);
  } catch {
    // Игрок уже вышел.
  }
}

function cancelSweep(id: number): void {
  const sweep = sweeps.get(id);
  if (!sweep) {
    return;
  }
  for (const timer of sweep.timers) {
    clearTimeout(timer);
  }
  sweeps.delete(id);
}

function spotBlocked(x: number, y: number): boolean {
  const now = Date.now();
  for (const spot of spots) {
    if (spot.until > now && distance2d(x, y, spot.x, spot.y) < SPOT_GAP) {
      return true;
    }
  }

  for (const sweep of sweeps.values()) {
    if (distance2d(x, y, sweep.x, sweep.y) < SPOT_GAP) {
      return true;
    }
  }

  return false;
}

function hasBroom(player: Player): boolean {
  const id = playerId(player);
  return id !== null && brooms.has(id);
}

function canHoldBroom(player: Player): boolean {
  if (!isJailed(player) || !inYard(player)) {
    return false;
  }
  return true;
}

function inYard(player: Player): boolean {
  try {
    return player.getVirtualWorld() === PRISON_YARD_WORLD && player.getInterior() === 0;
  } catch {
    return false;
  }
}

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Игрок уже вышел.
  }
}
