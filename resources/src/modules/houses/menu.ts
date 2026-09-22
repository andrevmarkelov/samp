import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { houseClassLabel } from "./classes";
import { houseLockStatusLabel } from "./enter";
import { findOwnedHouseAtInterior } from "./interior";
import { formatRentDate, rentDaysLeftLabel, rentDaysRemaining } from "./rent-math";
import {
  getHouse,
  purchaseHouseMedkit,
  saveHouseLock,
  setHouseLock,
  setHouseMedkit,
} from "./repository";
export const HOUSE_MENU_DIALOG_ID = 44;
export const HOUSE_MEDKIT_DIALOG_ID = 45;
export const HOUSE_INFO_DIALOG_ID = 50;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_LIST = 2;
const MENU_TITLE = "{FFCC00}";
const MENU_LABEL = "{FFFFFF}";
const MENU_VALUE = "{33CCFF}";
const MEDKIT_PRICE = 7500;

const pendingMedkitHouse = new Map<number, number>();
const savingLock = new Set<number>();
const buyingMedkit = new Set<number>();

export function bindHouseMenuDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    const id = Number(dialogId);
    const ok = Number(response) !== 0;
    const account = getAccount(player);
    if (!account) {
      return;
    }

    if (id === HOUSE_MENU_DIALOG_ID) {
      if (!ok) {
        return;
      }

      const house = findOwnedHouseAtInterior(player);
      if (!house || house.ownerId !== account.id) {
        player.sendClientMessage(Color.error, "Меню дома доступно только внутри вашего дома.");
        return;
      }

      const item = Number(listItem);
      if (item === 0) {
        void toggleHouseLock(player, house.id);
        return;
      }

      if (item === 1) {
        void openMedkitFlow(player, house.id);
        return;
      }

      if (item === 2) {
        showHouseInfoDialog(player, house);
      }
      return;
    }

    if (id === HOUSE_INFO_DIALOG_ID) {
      if (!ok) {
        return;
      }

      showHouseMenu(player);
      return;
    }

    if (id === HOUSE_MEDKIT_DIALOG_ID) {
      const houseId = pendingMedkitHouse.get(account.id);
      pendingMedkitHouse.delete(account.id);
      if (!ok || houseId === undefined) {
        return;
      }

      void buyMedkit(player, houseId);
    }
  });

  omp.on("playerDisconnect", () => {
    // account.id unavailable here easily; pending cleared on next login attempt
  });
}

export function showHouseMenu(player: Player): void {
  const house = findOwnedHouseAtInterior(player);
  if (!house) {
    player.sendClientMessage(Color.error, "Меню дома доступно только внутри вашего дома.");
    return;
  }

  const items = [
    `Статус (${houseLockStatusLabel(house.isLocked)})`,
    "Аптечка",
    "Информация",
  ];

  try {
    Dialog.show(
      player,
      HOUSE_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `${MENU_TITLE}Меню дома`,
      items.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть меню дома.");
  }
}

async function toggleHouseLock(player: Player, houseId: number): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = findOwnedHouseAtInterior(player);
  if (!house || house.id !== houseId || house.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Меню дома доступно только внутри вашего дома.");
    return;
  }

  if (savingLock.has(account.id)) {
    return;
  }

  const nextLocked = !house.isLocked;
  savingLock.add(account.id);

  let saved = false;
  try {
    saved = await saveHouseLock(houseId, account.id, nextLocked);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] замок дома ${houseId} (${account.name}): ${message}`);
  } finally {
    savingLock.delete(account.id);
  }

  if (!saved) {
    player.sendClientMessage(Color.error, "Не удалось изменить статус дома.");
    return;
  }

  setHouseLock(houseId, nextLocked);
  player.sendClientMessage(
    Color.info,
    nextLocked ? "Дом закрыт." : "Дом открыт."
  );
  showHouseMenu(player);
}

async function openMedkitFlow(player: Player, houseId: number): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = getHouse(houseId);
  if (!house || house.ownerId !== account.id) {
    return;
  }

  if (!findOwnedHouseAtInterior(player)) {
    player.sendClientMessage(Color.error, "Меню дома доступно только внутри вашего дома.");
    return;
  }

  if (house.hasMedkit) {
    player.sendClientMessage(Color.info, "В доме уже есть аптечка.");
    showHouseMenu(player);
    return;
  }

  pendingMedkitHouse.set(account.id, houseId);
  try {
    Dialog.show(
      player,
      HOUSE_MEDKIT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Аптечка",
      `Купить аптечку за $${MEDKIT_PRICE}?`,
      "Купить",
      "Отмена"
    );
  } catch {
    pendingMedkitHouse.delete(account.id);
    player.sendClientMessage(Color.error, "Не удалось открыть покупку аптечки.");
  }
}

async function buyMedkit(player: Player, houseId: number): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = getHouse(houseId);
  if (!house || house.ownerId !== account.id) {
    return;
  }

  if (!findOwnedHouseAtInterior(player)) {
    player.sendClientMessage(Color.error, "Покупка доступна только внутри вашего дома.");
    return;
  }

  if (house.hasMedkit) {
    player.sendClientMessage(Color.info, "В доме уже есть аптечка.");
    return;
  }

  const cash = Math.max(0, Math.floor(account.money));
  if (cash < MEDKIT_PRICE) {
    player.sendClientMessage(Color.error, "Недостаточно наличных.");
    return;
  }

  if (buyingMedkit.has(account.id)) {
    return;
  }

  buyingMedkit.add(account.id);
  let result;
  try {
    result = await purchaseHouseMedkit(houseId, account.id, MEDKIT_PRICE);
  } catch (error: unknown) {
    buyingMedkit.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] аптечка дома ${houseId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }
  buyingMedkit.delete(account.id);

  if (!result.ok) {
    if (result.reason === "exists") {
      player.sendClientMessage(Color.info, "В доме уже есть аптечка.");
      setHouseMedkit(houseId, true);
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  if (getAccount(player)?.id !== account.id) {
    return;
  }

  setHouseMedkit(houseId, true);
  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  void saveUserMoney(account.id, result.cashLeft, account.bank).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить деньги ${account.name}: ${message}`);
  });

  player.sendClientMessage(Color.info, `Аптечка куплена за $${MEDKIT_PRICE}.`);
  showHouseMenu(player);
}

function showHouseInfoDialog(player: Player, house: ReturnType<typeof findOwnedHouseAtInterior>): void {
  if (!house) {
    return;
  }

  const daysLeft = rentDaysRemaining(house.rentPaidUntil);
  const rentLines = buildRentInfoLines(house.rentPaidUntil, daysLeft);
  const body = [
    `${MENU_LABEL}Номер дома:\t\t${MENU_VALUE}${house.id}`,
    `${MENU_LABEL}Класс:\t\t\t${MENU_VALUE}${houseClassLabel(house.classId)}`,
    `${MENU_LABEL}Гос. стоимость:\t${MENU_VALUE}$${house.price}`,
    ...rentLines,
  ].join("\n");

  try {
    Dialog.show(
      player,
      HOUSE_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${MENU_TITLE}Информация о доме`,
      body,
      "Назад",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть информацию о доме.");
  }
}

function buildRentInfoLines(
  rentPaidUntil: string | null,
  daysLeft: number | null
): string[] {
  if (rentPaidUntil === null) {
    return [`${MENU_LABEL}Оплата:\t\t${MENU_VALUE}не оплачен`];
  }

  const lines = [
    `${MENU_LABEL}Оплачено до:\t\t${MENU_VALUE}${formatRentDate(rentPaidUntil)}`,
  ];

  if (daysLeft === null) {
    return lines;
  }

  if (daysLeft === 0) {
    lines.push(`${MENU_LABEL}Срок:\t\t\t${MENU_VALUE}сегодня последний день`);
    return lines;
  }

  lines.push(
    `${MENU_LABEL}Осталось:\t\t${MENU_VALUE}${daysLeft} ${rentDaysLeftLabel(daysLeft)}`
  );
  return lines;
}
