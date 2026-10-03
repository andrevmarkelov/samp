import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserFamily, saveUserMoney } from "../auth/repository";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { MERIYA_CUSTOM_INTERIOR, MERIYA_WORLD } from "../org/meriya";
import { getFamilyMembership } from "./membership";
import { createFamily, deleteFamily, findFamilyByName } from "./repository";
import { syncFamilyTag } from "./tags";
import {
  FAMILY_CREATE_COST,
  FAMILY_CREATE_MIN_LEVEL,
  FAMILY_NAME_MAX,
  FAMILY_NAME_MIN,
  MAX_FAMILY_RANK,
} from "./types";

export const FAMILY_CREATE_CONFIRM_DIALOG_ID = 113;
export const FAMILY_CREATE_NAME_DIALOG_ID = 114;

const PICKUP_MODEL = 19131;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;

/** Пикап регистрации семьи в интерьере мэрии. */
const CREATE_PICKUP = {
  x: -812.8052,
  y: -672.9063,
  z: 4001.0859,
  world: MERIYA_WORLD,
  interior: MERIYA_CUSTOM_INTERIOR,
} as const;

const standingOn = new Set<number>();
const dialogOpen = new Set<number>();

export function startFamilyCreateOffice(): void {
  new Pickup(
    PICKUP_MODEL,
    PICKUP_TYPE,
    CREATE_PICKUP.x,
    CREATE_PICKUP.y,
    CREATE_PICKUP.z,
    CREATE_PICKUP.world
  );
  new TextLabel(
    "Регистрация семьи",
    Color.info,
    CREATE_PICKUP.x,
    CREATE_PICKUP.y,
    CREATE_PICKUP.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    CREATE_PICKUP.world,
    false
  );

  setInterval(tickCreateOffice, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, _listItem, inputText) => {
    const id = Number(dialogId);
    if (id === FAMILY_CREATE_CONFIRM_DIALOG_ID) {
      onConfirmResponse(player, Number(response) !== 0);
      return;
    }

    if (id === FAMILY_CREATE_NAME_DIALOG_ID) {
      onNameResponse(player, Number(response) !== 0, String(inputText ?? ""));
    }
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    standingOn.delete(id);
    dialogOpen.delete(id);
  });
}

function tickCreateOffice(): void {
  omp.players.forEach((player) => {
    updatePlayer(player);
  });
}

function updatePlayer(player: Player): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  if (!isOnCreatePickup(player)) {
    standingOn.delete(id);
    return;
  }

  if (standingOn.has(id) || dialogOpen.has(id)) {
    return;
  }

  standingOn.add(id);
  tryOpenConfirm(player);
}

function isOnCreatePickup(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== CREATE_PICKUP.world) {
      return false;
    }
    if (player.getInterior() !== CREATE_PICKUP.interior) {
      return false;
    }
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(
        pos.x - CREATE_PICKUP.x,
        pos.y - CREATE_PICKUP.y,
        pos.z - CREATE_PICKUP.z
      ) <= PICKUP_RADIUS
    );
  } catch {
    return false;
  }
}

function tryOpenConfirm(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (!account.passport) {
    tell(player, Color.error, "Для создания семьи нужен паспорт.");
    return;
  }

  if (account.level < FAMILY_CREATE_MIN_LEVEL) {
    tell(
      player,
      Color.error,
      `Создать семью можно с ${FAMILY_CREATE_MIN_LEVEL} уровня.`
    );
    return;
  }

  if (getFamilyMembership(account)) {
    tell(player, Color.error, "Вы уже состоите в семье.");
    return;
  }

  if (account.money < FAMILY_CREATE_COST) {
    tell(
      player,
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(FAMILY_CREATE_COST)}.`
    );
    return;
  }

  showConfirmDialog(player);
}

function showConfirmDialog(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const body =
    `Регистрация семьи в мэрии.\n\n` +
    `Стоимость: ${formatMoney(FAMILY_CREATE_COST)}\n` +
    `Требования: паспорт, уровень ${FAMILY_CREATE_MIN_LEVEL}+\n` +
    `Оплата списывается с наличных.\n\n` +
    `Продолжить регистрацию?`;

  try {
    dialogOpen.add(id);
    Dialog.show(
      player,
      FAMILY_CREATE_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Регистрация семьи",
      body,
      "Принять",
      "Отмена"
    );
  } catch {
    dialogOpen.delete(id);
  }
}

function onConfirmResponse(player: Player, accepted: boolean): void {
  const id = playerId(player);
  if (id !== null) {
    dialogOpen.delete(id);
  }

  if (!accepted) {
    tell(player, Color.info, "Регистрация семьи отменена.");
    return;
  }

  if (!isOnCreatePickup(player)) {
    tell(player, Color.error, "Встаньте на пикап регистрации семьи.");
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (!account.passport) {
    tell(player, Color.error, "Для создания семьи нужен паспорт.");
    return;
  }

  if (account.level < FAMILY_CREATE_MIN_LEVEL) {
    tell(
      player,
      Color.error,
      `Создать семью можно с ${FAMILY_CREATE_MIN_LEVEL} уровня.`
    );
    return;
  }

  if (getFamilyMembership(account)) {
    tell(player, Color.error, "Вы уже состоите в семье.");
    return;
  }

  if (account.money < FAMILY_CREATE_COST) {
    tell(
      player,
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(FAMILY_CREATE_COST)}.`
    );
    return;
  }

  showNameDialog(player);
}

function showNameDialog(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const body =
    `Введите название семьи.\n` +
    `Только английские буквы и пробелы.\n` +
    `Пример: Woozie Family\n` +
    `Длина: ${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX} символов.\n` +
    `Стоимость: ${formatMoney(FAMILY_CREATE_COST)}`;

  try {
    dialogOpen.add(id);
    Dialog.show(
      player,
      FAMILY_CREATE_NAME_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Название семьи",
      body,
      "Создать",
      "Отмена"
    );
  } catch {
    dialogOpen.delete(id);
  }
}

function onNameResponse(player: Player, accepted: boolean, rawName: string): void {
  const id = playerId(player);
  if (id !== null) {
    dialogOpen.delete(id);
  }

  if (!accepted) {
    tell(player, Color.info, "Регистрация семьи отменена.");
    return;
  }

  if (!isOnCreatePickup(player)) {
    tell(player, Color.error, "Встаньте на пикап регистрации семьи.");
    return;
  }

  const name = normalizeFamilyName(rawName);
  if (!name) {
    tell(
      player,
      Color.error,
      `Некорректное название. Только A-Z, a-z и пробелы (${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX}).`
    );
    showNameDialog(player);
    return;
  }

  void createFamilyForPlayer(player, name);
}

async function createFamilyForPlayer(player: Player, name: string): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (!account.passport) {
    tell(player, Color.error, "Для создания семьи нужен паспорт.");
    return;
  }

  if (account.level < FAMILY_CREATE_MIN_LEVEL) {
    tell(
      player,
      Color.error,
      `Создать семью можно с ${FAMILY_CREATE_MIN_LEVEL} уровня.`
    );
    return;
  }

  if (getFamilyMembership(account)) {
    tell(player, Color.error, "Вы уже состоите в семье.");
    return;
  }

  if (account.money < FAMILY_CREATE_COST) {
    tell(
      player,
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(FAMILY_CREATE_COST)}.`
    );
    return;
  }

  const exists = await findFamilyByName(name);
  if (exists) {
    tell(player, Color.error, "Семья с таким названием уже существует.");
    showNameDialog(player);
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== account.id) {
    return;
  }

  if (!live.passport) {
    tell(player, Color.error, "Для создания семьи нужен паспорт.");
    return;
  }

  if (live.level < FAMILY_CREATE_MIN_LEVEL) {
    tell(
      player,
      Color.error,
      `Создать семью можно с ${FAMILY_CREATE_MIN_LEVEL} уровня.`
    );
    return;
  }

  if (getFamilyMembership(live)) {
    tell(player, Color.error, "Вы уже состоите в семье.");
    return;
  }

  if (live.money < FAMILY_CREATE_COST) {
    tell(
      player,
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(FAMILY_CREATE_COST)}.`
    );
    return;
  }

  const nextMoney = live.money - FAMILY_CREATE_COST;
  try {
    await saveUserMoney(live.id, nextMoney, live.bank);
  } catch {
    tell(player, Color.error, "Не удалось сохранить в базу.");
    return;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== live.id) {
    // Деньги уже списаны в БД — вернуть, семья не создана.
    await saveUserMoney(live.id, live.money, live.bank).catch(() => undefined);
    return;
  }

  patchAccount(player, { money: nextMoney });
  applyWallet(player, { ...getAccount(player)!, money: nextMoney });

  let family;
  try {
    family = await createFamily({
      name,
      description: "",
      ownerId: live.id,
    });
  } catch {
    await refundCreateCost(player, live.id, live.money, live.bank);
    tell(player, Color.error, "Не удалось создать семью. Возможно, имя занято.");
    return;
  }

  const ok = await setFamily(player, family.id, MAX_FAMILY_RANK);
  if (!ok) {
    await deleteFamily(family.id).catch(() => undefined);
    await refundCreateCost(player, live.id, live.money, live.bank);
    tell(player, Color.error, "Не удалось сохранить членство в семье.");
    return;
  }

  tell(
    player,
    Color.info,
    `Семья «${family.name}» зарегистрирована. Списано ${formatMoney(FAMILY_CREATE_COST)}.`
  );
}

/** Только латиница и одиночные пробелы, напр. Woozie Family. */
export function normalizeFamilyName(raw: string): string | null {
  const name = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (name.length < FAMILY_NAME_MIN || name.length > FAMILY_NAME_MAX) {
    return null;
  }

  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
    return null;
  }

  return name;
}

async function setFamily(
  player: Player,
  familyId: number,
  familyRank: number
): Promise<boolean> {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  try {
    await saveUserFamily(account.id, familyId, familyRank);
  } catch {
    return false;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return false;
  }

  patchAccount(player, { familyId, familyRank });
  syncFamilyTag(player);
  return true;
}

async function refundCreateCost(
  player: Player,
  userId: number,
  money: number,
  bank: number
): Promise<void> {
  await saveUserMoney(userId, money, bank).catch(() => undefined);
  if (!isPlayerActive(player) || getAccount(player)?.id !== userId) {
    return;
  }

  patchAccount(player, { money });
  applyWallet(player, { ...getAccount(player)!, money });
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}
