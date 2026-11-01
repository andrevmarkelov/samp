import { Checkpoint, Dialog, omp, Pickup, RaceCheckpoint, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { isCuffed } from "../cuff";
import { queueSave } from "../persist";
import { PRISON_WORLD } from "../spawn/point";
import { isJailed, reduceJailSeconds } from "./sentence";

export const KITCHEN_OVEN_DIALOG_ID = 172;

const FOOD_MODEL = 19582;
const DROP_MODEL = 19135;
const RACE_CP_NORMAL = 0;
const READY_COLOR = "99FF99";
const OVEN_TOGGLE_COLOR = "FF9933";
const FOOD_SLOT = 5;
const FOOD_BONE = 6;
const PICKUP_TYPE = 1;
const DIALOG_STYLE_LIST = 2;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const OVEN_RADIUS = 1;
const OVEN_ACT_RADIUS = 1.5;
const OVEN_MARKER_RANGE = 25;
const LABEL_HEIGHT = 0.9;
const LABEL_DRAW_DISTANCE = 12;
const TICK_MS = 200;
const COOK_MS = 60_000;
const MAX_COOK_STEP_MS = 2_000;
const SLOT_COUNT = 5;
const SENTENCE_CUT_SECONDS = 15;
const COOK_PAY = 25;
const MAX_CASH = 2_147_483_647;

const FOOD_POINT = { x: -100.7172, y: 2431.9692, z: 1179.3196 } as const;
const DROP_POINT = { x: -107.3645, y: 2432.1489, z: 1179.3196 } as const;
const OVEN_POINTS = [
  { x: -103.0799, y: 2437.7791, z: 1179.3196 },
  { x: -105.057, y: 2437.7808, z: 1179.3196 },
] as const;

type Carry = "raw" | "cooked";
type SlotView = "empty" | "cooking" | "ready";

type OvenView = {
  ovenIndex: number;
  on: boolean;
  slots: SlotView[];
};

type OvenSlot = {
  /** Сколько ещё греть. 0 — можно забирать. */
  remainingMs: number;
};

type Oven = {
  x: number;
  y: number;
  z: number;
  on: boolean;
  slots: Array<OvenSlot | null>;
  label: TextLabel;
};

const carry = new Map<number, Carry>();
const standing = new Map<number, string>();
const ovenDialog = new Map<number, OvenView>();
const cuffWarned = new Set<number>();
const ovenMarkers = new Set<number>();
const ovens: Oven[] = [];
let lastCookAt = 0;
let bound = false;

export function bindKitchen(): void {
  if (bound) {
    return;
  }
  bound = true;
  lastCookAt = Date.now();

  new Pickup(FOOD_MODEL, PICKUP_TYPE, FOOD_POINT.x, FOOD_POINT.y, FOOD_POINT.z, PRISON_WORLD);
  new Pickup(DROP_MODEL, PICKUP_TYPE, DROP_POINT.x, DROP_POINT.y, DROP_POINT.z, PRISON_WORLD);

  for (const point of OVEN_POINTS) {
    const label = new TextLabel(
      ovenLabel(false),
      Color.gray,
      point.x,
      point.y,
      point.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      PRISON_WORLD,
      false
    );
    ovens.push({
      x: point.x,
      y: point.y,
      z: point.z,
      on: false,
      slots: Array.from({ length: SLOT_COUNT }, () => null),
      label,
    });
  }

  setInterval(tickKitchen, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== KITCHEN_OVEN_DIALOG_ID) {
      return;
    }
    if (Number(response) === 0) {
      return;
    }
    onOvenChoice(player, Number(listItem));
  });

  omp.on("playerDeath", (player) => {
    dropFood(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }
    carry.delete(id);
    standing.delete(id);
    ovenDialog.delete(id);
    cuffWarned.delete(id);
    ovenMarkers.delete(id);
  });
}

function tickKitchen(): void {
  cookStep();

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    if (carry.has(id) && !canCarry(player)) {
      dropFood(player);
    }

    try {
      const pos = player.getPos();
      syncOvenMarkers(player, id, pos.x, pos.y, pos.z);

      if (player.getState() !== PLAYER_STATE_ONFOOT || !inPrison(player)) {
        standing.delete(id);
        cuffWarned.delete(id);
        return;
      }

      const point = pointAt(pos.x, pos.y, pos.z);
      if (point === null) {
        standing.delete(id);
        cuffWarned.delete(id);
        return;
      }
      if (isCuffed(player)) {
        if (standing.get(id) === point) {
          return;
        }
        if (!cuffWarned.has(id)) {
          cuffWarned.add(id);
          tell(player, Color.error, "В наручниках готовить нельзя.");
        }
        return;
      }
      cuffWarned.delete(id);
      if (standing.get(id) === point) {
        return;
      }

      standing.set(id, point);
      onPointEnter(player, point);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function cookStep(): void {
  const now = Date.now();
  const delta = Math.min(MAX_COOK_STEP_MS, Math.max(0, now - lastCookAt));
  lastCookAt = now;
  if (delta <= 0) {
    return;
  }

  for (const oven of ovens) {
    if (!oven.on) {
      continue;
    }
    for (const slot of oven.slots) {
      if (!slot || slot.remainingMs <= 0) {
        continue;
      }
      slot.remainingMs = Math.max(0, slot.remainingMs - delta);
    }
  }
}

function onPointEnter(player: Player, point: string): void {
  if (!isJailed(player)) {
    tell(player, Color.error, "Готовить могут только заключённые.");
    return;
  }

  if (point === "food") {
    takeIngredients(player);
    return;
  }
  if (point === "drop") {
    deliverFood(player);
    return;
  }

  const ovenIndex = ovenIndexFromPoint(point);
  if (ovenIndex !== null) {
    showOven(player, ovenIndex);
  }
}

function takeIngredients(player: Player): void {
  const held = heldFood(player);
  if (held === "cooked") {
    tell(player, Color.error, "Отнесите готовую еду на сдачу.");
    return;
  }
  if (held === "raw") {
    dropFood(player);
    tell(player, Color.info, "Вы вернули еду.");
    return;
  }
  if (!giveFood(player, "raw")) {
    tell(player, Color.error, "Не удалось взять еду.");
    return;
  }
  tell(player, Color.info, "Вы взяли еду. Положите её в печь.");
}

function deliverFood(player: Player): void {
  if (heldFood(player) !== "cooked") {
    tell(
      player,
      Color.error,
      heldFood(player) === "raw" ? "Сначала приготовьте еду в печи." : "У вас нет готовой еды."
    );
    return;
  }

  dropFood(player);
  const paid = payCook(player);
  const result = reduceJailSeconds(player, SENTENCE_CUT_SECONDS);
  if (result === "reduced") {
    const money = paid > 0 ? ` Получено ${formatMoney(paid)}.` : "";
    tell(player, Color.info, `Вы сдали еду. Срок уменьшен на 15 секунд.${money}`);
    return;
  }
  if (paid > 0) {
    tell(player, Color.info, `Вы сдали еду. Получено ${formatMoney(paid)}.`);
  }
}

function onOvenChoice(player: Player, listItem: number): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player)) {
    return;
  }

  const view = ovenDialog.get(id);
  if (!view) {
    return;
  }
  const oven = ovens[view.ovenIndex];
  if (!oven) {
    ovenDialog.delete(id);
    return;
  }

  if (!isJailed(player)) {
    ovenDialog.delete(id);
    tell(player, Color.error, "Готовить могут только заключённые.");
    return;
  }
  if (isCuffed(player)) {
    ovenDialog.delete(id);
    tell(player, Color.error, "В наручниках готовить нельзя.");
    return;
  }
  if (!inPrison(player) || !nearOven(player, oven)) {
    ovenDialog.delete(id);
    tell(player, Color.error, "Подойдите к печи.");
    return;
  }

  if (listItem === SLOT_COUNT) {
    if (oven.on !== view.on) {
      tell(player, Color.error, "Печь уже переключили.");
      showOven(player, view.ovenIndex);
      return;
    }
    oven.on = !oven.on;
    refreshOvenLabel(oven);
    tell(player, Color.info, oven.on ? "Печь включена." : "Печь выключена.");
    showOven(player, view.ovenIndex);
    return;
  }

  if (!Number.isInteger(listItem) || listItem < 0 || listItem >= SLOT_COUNT) {
    return;
  }

  const expected = view.slots[listItem] ?? "empty";
  const slot = oven.slots[listItem] ?? null;
  const actual = slotView(slot);
  if (expected !== actual) {
    tell(player, Color.error, slotChangedMessage(expected, actual));
    showOven(player, view.ovenIndex);
    return;
  }

  if (actual === "empty") {
    placeFood(player, oven, listItem);
  } else if (actual === "ready") {
    takeCooked(player, oven, listItem);
  } else {
    tell(player, Color.error, "Еда ещё готовится.");
  }

  showOven(player, view.ovenIndex);
}

function placeFood(player: Player, oven: Oven, index: number): void {
  if (oven.slots[index]) {
    tell(player, Color.error, "Это место уже занято.");
    return;
  }
  if (heldFood(player) === "cooked") {
    tell(player, Color.error, "Эта еда уже готова. Отнесите её на сдачу.");
    return;
  }
  if (heldFood(player) !== "raw") {
    tell(player, Color.error, "Сначала возьмите еду.");
    return;
  }

  dropFood(player);
  oven.slots[index] = { remainingMs: COOK_MS };
  tell(player, Color.info, oven.on ? "Еда в печи и готовится." : "Еда в печи. Включите печь, чтобы она готовилась.");
}

function takeCooked(player: Player, oven: Oven, index: number): void {
  const slot = oven.slots[index];
  if (!slot || slot.remainingMs > 0) {
    return;
  }
  if (heldFood(player)) {
    tell(player, Color.error, "Сначала освободите руки.");
    return;
  }
  if (!giveFood(player, "cooked")) {
    tell(player, Color.error, "Не удалось взять еду.");
    return;
  }
  oven.slots[index] = null;
  tell(player, Color.info, "Вы взяли готовую еду. Отнесите её на сдачу.");
}

function showOven(player: Player, ovenIndex: number): void {
  const oven = ovens[ovenIndex];
  const id = playerId(player);
  if (!oven || id === null) {
    return;
  }

  ovenDialog.set(id, {
    ovenIndex,
    on: oven.on,
    slots: oven.slots.map((slot) => slotView(slot)),
  });
  const lines = oven.slots.map((slot, index) => slotListLine(index, slot));
  lines.push(`{${OVEN_TOGGLE_COLOR}}${SLOT_COUNT + 1}. ${oven.on ? "Выключить печь" : "Включить печь"}`);

  try {
    Dialog.show(
      player,
      KITCHEN_OVEN_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Печь",
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть печь.");
  }
}

function slotView(slot: OvenSlot | null): SlotView {
  if (!slot) {
    return "empty";
  }
  return slot.remainingMs <= 0 ? "ready" : "cooking";
}

function slotChangedMessage(expected: SlotView, actual: SlotView): string {
  if (expected === "ready" && actual === "empty") {
    return "Эту еду уже забрали.";
  }
  if (expected === "empty") {
    return "Это место уже занято.";
  }
  return "Печь уже изменилась.";
}

function nearOven(player: Player, oven: Oven): boolean {
  try {
    const pos = player.getPos();
    return distance3d(pos.x, pos.y, pos.z, oven.x, oven.y, oven.z) <= OVEN_ACT_RADIUS;
  } catch {
    return false;
  }
}

function slotListLine(index: number, slot: OvenSlot | null): string {
  if (!slot) {
    return `${index + 1}. Положить еду`;
  }
  if (slot.remainingMs <= 0) {
    return `{${READY_COLOR}}${index + 1}. Достать еду`;
  }

  const seconds = Math.max(1, Math.ceil(slot.remainingMs / 1000));
  return `${index + 1}. Готовится (${seconds} сек.)`;
}

function syncOvenMarkers(player: Player, id: number, x: number, y: number, z: number): void {
  const show = isJailed(player) && inPrison(player) && nearOvens(x, y, z);
  if (show === ovenMarkers.has(id)) {
    return;
  }

  if (!show) {
    ovenMarkers.delete(id);
    hideOvenMarkers(player);
    return;
  }

  const first = ovens[0];
  const second = ovens[1];
  if (!first) {
    return;
  }

  try {
    Checkpoint.set(player, first.x, first.y, first.z, OVEN_RADIUS);
    if (second) {
      RaceCheckpoint.set(
        player,
        RACE_CP_NORMAL,
        second.x,
        second.y,
        second.z,
        second.x,
        second.y,
        second.z,
        OVEN_RADIUS
      );
    }
    ovenMarkers.add(id);
  } catch {
    // Метку не удалось поставить.
  }
}

function hideOvenMarkers(player: Player): void {
  try {
    Checkpoint.disable(player);
  } catch {
    // Метки уже нет.
  }
  try {
    RaceCheckpoint.disable(player);
  } catch {
    // Метки уже нет.
  }
}

function nearOvens(x: number, y: number, z: number): boolean {
  return ovens.some(
    (oven) => distance3d(x, y, z, oven.x, oven.y, oven.z) <= OVEN_MARKER_RANGE
  );
}

function refreshOvenLabel(oven: Oven): void {
  try {
    oven.label.updateText(oven.on ? Color.tryOk : Color.gray, ovenLabel(oven.on));
  } catch {
    // Лейбл уже уничтожен.
  }
}

function ovenLabel(on: boolean): string {
  return on ? "Печь\nВключена" : "Печь\nОтключена";
}

function giveFood(player: Player, kind: Carry): boolean {
  const id = playerId(player);
  if (id === null || carry.has(id)) {
    return false;
  }

  let attached = false;
  try {
    attached = player.setAttachedObject(
      FOOD_SLOT,
      FOOD_MODEL,
      FOOD_BONE,
      0.07,
      0.03,
      0,
      0,
      90,
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
    return false;
  }

  carry.set(id, kind);
  return true;
}

function dropFood(player: Player): void {
  const id = playerId(player);
  if (id === null || !carry.has(id)) {
    return;
  }

  carry.delete(id);
  try {
    player.removeAttachedObject(FOOD_SLOT);
  } catch {
    // Объект уже снят.
  }
}

function payCook(player: Player): number {
  const account = getAccount(player);
  if (!account) {
    return 0;
  }

  const next = Math.max(0, Math.min(MAX_CASH, Math.floor(account.money + COOK_PAY)));
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

function heldFood(player: Player): Carry | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }
  return carry.get(id) ?? null;
}

function canCarry(player: Player): boolean {
  return isJailed(player) && inPrison(player);
}

function inPrison(player: Player): boolean {
  try {
    return player.getVirtualWorld() === PRISON_WORLD && player.getInterior() === 0;
  } catch {
    return false;
  }
}

function pointAt(x: number, y: number, z: number): string | null {
  if (distance3d(x, y, z, FOOD_POINT.x, FOOD_POINT.y, FOOD_POINT.z) <= PICKUP_RADIUS) {
    return "food";
  }
  if (distance3d(x, y, z, DROP_POINT.x, DROP_POINT.y, DROP_POINT.z) <= PICKUP_RADIUS) {
    return "drop";
  }

  let nearest = -1;
  let nearestDistance = OVEN_RADIUS;
  for (let index = 0; index < ovens.length; index += 1) {
    const oven = ovens[index];
    if (!oven) {
      continue;
    }
    const distance = distance3d(x, y, z, oven.x, oven.y, oven.z);
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }

  return nearest >= 0 ? `oven:${nearest}` : null;
}

function ovenIndexFromPoint(point: string): number | null {
  if (!point.startsWith("oven:")) {
    return null;
  }
  const index = Number(point.slice(5));
  return Number.isInteger(index) && ovens[index] ? index : null;
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
