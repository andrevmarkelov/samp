import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserInventory, saveUserMoney } from "../auth/repository";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { findOwnedHouseAtInterior } from "./interior";
import {
  addHouseStoreItem,
  getHouse,
  hasHouseStore,
  takeHouseStoreItem,
} from "./repository";
import {
  isPlayerAtHouseStore,
  refreshHouseStoreLabel,
  removeHouseStoreLabel,
} from "./store-display";

export const HOUSE_STORE_MENU_DIALOG_ID = 142;
export const HOUSE_STORE_AMOUNT_DIALOG_ID = 143;

const DIALOG_STYLE_LIST = 2;
const DIALOG_STYLE_INPUT = 1;
const PLAYER_STATE_ONFOOT = 1;
const MAX_TRANSFER = 10_000;
const MAX_MONEY_TRANSFER = 1_000_000;
const MAX_CASH = 2_147_483_647;
const LIME = "{9ACD32}";

type StockItem = "ammo" | "metal" | "drugs" | "money";
type StockAction = "put" | "take";

type PendingTransfer = {
  houseId: number;
  action: StockAction;
  item: StockItem;
};

const ITEM_LABEL: Record<StockItem, string> = {
  ammo: "патроны",
  metal: "металл",
  drugs: "наркотики",
  money: "деньги",
};

const pendingByPlayer = new Map<number, PendingTransfer>();
const dialogBusy = new Set<number>();
const transferBusy = new Set<number>();

export function bindHouseStoreDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (id === HOUSE_STORE_MENU_DIALOG_ID) {
      setDialogBusy(player, false);
      onMenuResponse(player, Number(response) !== 0, Number(listItem));
      return;
    }

    if (id === HOUSE_STORE_AMOUNT_DIALOG_ID) {
      void (async () => {
        try {
          await onAmountResponse(
            player,
            Number(response) !== 0,
            String(inputText ?? "")
          );
        } finally {
          const slot = playerId(player);
          if (slot === null || !pendingByPlayer.has(slot)) {
            setDialogBusy(player, false);
          }
        }
      })();
    }
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    pendingByPlayer.delete(id);
    dialogBusy.delete(id);
    transferBusy.delete(id);
  });
}

/** Вызывается при изъятии/продаже дома. */
export function onHouseStoreVacated(houseId: number): void {
  removeHouseStoreLabel(houseId);
}

/** Открыть меню шкафа (/use). */
export function tryOpenHouseStore(player: Player): void {
  if (!isAuthenticated(player)) {
    player.sendClientMessage(Color.error, "Сначала войдите в аккаунт.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Нужно стоять пешком.");
      return;
    }
  } catch {
    return;
  }

  const house = findOwnedHouseAtInterior(player);
  if (!house) {
    player.sendClientMessage(
      Color.error,
      "Шкафом может пользоваться только владелец в своём доме."
    );
    return;
  }

  if (!hasHouseStore(house)) {
    player.sendClientMessage(
      Color.error,
      "Сначала установите шкаф: /makestore"
    );
    return;
  }

  if (!isPlayerAtHouseStore(player, house)) {
    player.sendClientMessage(Color.error, "Подойдите ближе к шкафу.");
    return;
  }

  const pid = playerId(player);
  if (pid !== null && (dialogBusy.has(pid) || transferBusy.has(pid))) {
    player.sendClientMessage(Color.error, "Подождите завершения операции.");
    return;
  }

  showMenu(player, house.id);
}

function showMenu(player: Player, houseId: number): void {
  const house = getHouse(houseId);
  if (!house) {
    return;
  }

  const body = [
    "Положить патроны",
    "Положить металл",
    "Положить наркотики",
    "Положить деньги",
    `${LIME}Взять патроны`,
    `${LIME}Взять металл`,
    `${LIME}Взять наркотики`,
    `${LIME}Взять деньги`,
  ].join("\n");

  try {
    setDialogBusy(player, true);
    Dialog.show(
      player,
      HOUSE_STORE_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Шкаф дома №${houseId}`,
      body,
      "Выбрать",
      "Отмена"
    );
  } catch {
    setDialogBusy(player, false);
    player.sendClientMessage(Color.error, "Не удалось открыть меню шкафа.");
  }
}

function onMenuResponse(player: Player, accepted: boolean, listItem: number): void {
  if (!accepted) {
    clearPending(player);
    return;
  }

  const house = findOwnedHouseAtInterior(player);
  if (!house || !hasHouseStore(house) || !isPlayerAtHouseStore(player, house)) {
    player.sendClientMessage(Color.error, "Подойдите ближе к шкафу.");
    return;
  }

  const choice = menuItemToAction(listItem);
  if (!choice) {
    return;
  }

  showAmountDialog(player, choice.action, choice.item, house.id);
}

function menuItemToAction(
  listItem: number
): { action: StockAction; item: StockItem } | null {
  switch (listItem) {
    case 0:
      return { action: "put", item: "ammo" };
    case 1:
      return { action: "put", item: "metal" };
    case 2:
      return { action: "put", item: "drugs" };
    case 3:
      return { action: "put", item: "money" };
    case 4:
      return { action: "take", item: "ammo" };
    case 5:
      return { action: "take", item: "metal" };
    case 6:
      return { action: "take", item: "drugs" };
    case 7:
      return { action: "take", item: "money" };
    default:
      return null;
  }
}

function showAmountDialog(
  player: Player,
  action: StockAction,
  item: StockItem,
  houseId: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const account = getAccount(player);
  const house = getHouse(houseId);
  if (!account || !house) {
    clearPending(player);
    return;
  }

  pendingByPlayer.set(id, { houseId, action, item });
  const verb = action === "put" ? "положить в шкаф" : "взять из шкафа";
  const maxTransfer = item === "money" ? MAX_MONEY_TRANSFER : MAX_TRANSFER;

  let playerHaveText: string;
  let stockHaveText: string;
  if (item === "money") {
    playerHaveText = `У вас: ${formatMoney(account.money)}`;
    stockHaveText = `В шкафу: ${formatMoney(house.storeMoney)}`;
  } else {
    const playerHave =
      item === "ammo" ? account.ammo : item === "metal" ? account.metal : account.drugs;
    const stockHave =
      item === "ammo"
        ? house.storeAmmo
        : item === "metal"
          ? house.storeMetal
          : house.storeDrugs;
    playerHaveText = `У вас: ${playerHave} шт.`;
    stockHaveText = `В шкафу: ${stockHave} шт.`;
  }

  try {
    setDialogBusy(player, true);
    Dialog.show(
      player,
      HOUSE_STORE_AMOUNT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Шкаф",
      `Сколько ${ITEM_LABEL[item]} ${verb}?\n` +
        `${playerHaveText}\n${stockHaveText}\n` +
        `Максимум за раз: ${item === "money" ? formatMoney(maxTransfer) : maxTransfer}`,
      "OK",
      "Отмена"
    );
  } catch {
    setDialogBusy(player, false);
    pendingByPlayer.delete(id);
  }
}

async function onAmountResponse(
  player: Player,
  accepted: boolean,
  rawInput: string
): Promise<void> {
  if (!accepted) {
    clearPending(player);
    return;
  }

  const id = playerId(player);
  const pending = id !== null ? pendingByPlayer.get(id) : undefined;
  if (!pending) {
    player.sendClientMessage(Color.error, "Операция прервана. Используйте /use снова.");
    return;
  }

  const house = findOwnedHouseAtInterior(player);
  if (
    !house ||
    house.id !== pending.houseId ||
    !hasHouseStore(house) ||
    !isPlayerAtHouseStore(player, house)
  ) {
    player.sendClientMessage(Color.error, "Подойдите ближе к шкафу.");
    clearPending(player);
    return;
  }

  const amount = Math.floor(Number(rawInput.trim().replace(",", ".")));
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amount)) {
    player.sendClientMessage(Color.error, "Введите целое число больше 0.");
    showAmountDialog(player, pending.action, pending.item, pending.houseId);
    return;
  }

  const maxTransfer =
    pending.item === "money" ? MAX_MONEY_TRANSFER : MAX_TRANSFER;
  if (amount > maxTransfer) {
    player.sendClientMessage(
      Color.error,
      pending.item === "money"
        ? `За один раз можно не больше ${formatMoney(maxTransfer)}.`
        : `За один раз можно не больше ${maxTransfer} шт.`
    );
    showAmountDialog(player, pending.action, pending.item, pending.houseId);
    return;
  }

  if (id !== null && transferBusy.has(id)) {
    // Не оставляем dialogBusy=true навечно (pending ещё жив).
    setDialogBusy(player, false);
    player.sendClientMessage(Color.error, "Подождите завершения операции.");
    return;
  }

  if (id !== null) {
    transferBusy.add(id);
  }

  try {
    if (pending.action === "put") {
      await applyPut(player, pending.houseId, pending.item, amount);
    } else {
      await applyTake(player, pending.houseId, pending.item, amount);
    }
  } finally {
    if (id !== null) {
      transferBusy.delete(id);
    }
  }
}

function assertStoreOwner(
  player: Player,
  houseId: number
): { account: NonNullable<ReturnType<typeof getAccount>>; house: NonNullable<ReturnType<typeof getHouse>> } | null {
  const account = getAccount(player);
  const house = findOwnedHouseAtInterior(player);
  if (
    !account ||
    !house ||
    house.id !== houseId ||
    house.ownerId !== account.id ||
    !hasHouseStore(house) ||
    !isPlayerAtHouseStore(player, house)
  ) {
    return null;
  }

  return { account, house };
}

async function applyPut(
  player: Player,
  houseId: number,
  item: StockItem,
  amount: number
): Promise<void> {
  const ctx = assertStoreOwner(player, houseId);
  if (!ctx) {
    player.sendClientMessage(Color.error, "Подойдите ближе к шкафу.");
    clearPending(player);
    return;
  }

  const { account } = ctx;

  if (item === "money") {
    if (account.money < amount) {
      player.sendClientMessage(Color.error, "Недостаточно наличных.");
      showAmountDialog(player, "put", item, houseId);
      return;
    }

    const nextMoney = account.money - amount;
    try {
      await saveUserMoney(account.id, nextMoney, account.bank);
    } catch {
      player.sendClientMessage(Color.error, "Не удалось сохранить в базу.");
      clearPending(player);
      return;
    }

    // Дом могли изъять между saveUserMoney и add.
    if (!assertStoreOwner(player, houseId)) {
      await saveUserMoney(account.id, account.money, account.bank).catch(() => undefined);
      if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
        patchAccount(player, { money: account.money });
        const live = getAccount(player);
        if (live) {
          applyWallet(player, live);
        }
      }
      player.sendClientMessage(Color.error, "Шкаф больше недоступен.");
      clearPending(player);
      return;
    }

    const stockTotal = await addHouseStoreItem(houseId, account.id, "money", amount);
    if (stockTotal === null) {
      await saveUserMoney(account.id, account.money, account.bank).catch(() => undefined);
      if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
        patchAccount(player, { money: account.money });
        const live = getAccount(player);
        if (live) {
          applyWallet(player, live);
        }
      }
      player.sendClientMessage(Color.error, "Не удалось положить деньги в шкаф.");
      clearPending(player);
      return;
    }

    if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
      patchAccount(player, { money: nextMoney });
      const live = getAccount(player);
      if (live) {
        applyWallet(player, live);
      }
    }

    refreshHouseStoreLabel(houseId);
    clearPending(player);
    if (isPlayerActive(player)) {
      player.sendClientMessage(
        Color.info,
        `Вы положили в шкаф: ${formatMoney(amount)}.`
      );
    }
    return;
  }

  const have =
    item === "ammo" ? account.ammo : item === "metal" ? account.metal : account.drugs;
  if (have < amount) {
    player.sendClientMessage(Color.error, `Недостаточно: ${ITEM_LABEL[item]}.`);
    showAmountDialog(player, "put", item, houseId);
    return;
  }

  const nextDrugs = item === "drugs" ? account.drugs - amount : account.drugs;
  const nextAmmo = item === "ammo" ? account.ammo - amount : account.ammo;
  const nextMetal = item === "metal" ? account.metal - amount : account.metal;

  try {
    await saveUserInventory(account.id, nextDrugs, nextAmmo, nextMetal);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось сохранить в базу.");
    clearPending(player);
    return;
  }

  if (!assertStoreOwner(player, houseId)) {
    await saveUserInventory(
      account.id,
      account.drugs,
      account.ammo,
      account.metal
    ).catch(() => undefined);
    if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
      patchAccount(player, {
        drugs: account.drugs,
        ammo: account.ammo,
        metal: account.metal,
      });
    }
    player.sendClientMessage(Color.error, "Шкаф больше недоступен.");
    clearPending(player);
    return;
  }

  const stockTotal = await addHouseStoreItem(houseId, account.id, item, amount);
  if (stockTotal === null) {
    await saveUserInventory(
      account.id,
      account.drugs,
      account.ammo,
      account.metal
    ).catch(() => undefined);
    if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
      patchAccount(player, {
        drugs: account.drugs,
        ammo: account.ammo,
        metal: account.metal,
      });
    }
    player.sendClientMessage(Color.error, "Не удалось положить в шкаф.");
    clearPending(player);
    return;
  }

  if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
    patchAccount(player, { drugs: nextDrugs, ammo: nextAmmo, metal: nextMetal });
  }

  refreshHouseStoreLabel(houseId);
  clearPending(player);
  if (isPlayerActive(player)) {
    player.sendClientMessage(
      Color.info,
      `Вы положили в шкаф: ${ITEM_LABEL[item]} ${amount} шт.`
    );
  }
}

async function applyTake(
  player: Player,
  houseId: number,
  item: StockItem,
  amount: number
): Promise<void> {
  const ctx = assertStoreOwner(player, houseId);
  if (!ctx) {
    player.sendClientMessage(Color.error, "Подойдите ближе к шкафу.");
    clearPending(player);
    return;
  }

  const { account, house } = ctx;

  if (item === "money") {
    const nextMoney = account.money + amount;
    if (!Number.isSafeInteger(nextMoney) || nextMoney > MAX_CASH) {
      player.sendClientMessage(Color.error, "Слишком много наличных.");
      clearPending(player);
      return;
    }

    if (!(await takeHouseStoreItem(houseId, account.id, "money", amount))) {
      player.sendClientMessage(Color.error, "В шкафу недостаточно денег.");
      showAmountDialog(player, "take", item, houseId);
      return;
    }

    try {
      await saveUserMoney(account.id, nextMoney, account.bank);
    } catch {
      await addHouseStoreItem(houseId, account.id, "money", amount);
      refreshHouseStoreLabel(houseId);
      player.sendClientMessage(Color.error, "Не удалось сохранить в базу.");
      clearPending(player);
      return;
    }

    if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
      patchAccount(player, { money: nextMoney });
      const live = getAccount(player);
      if (live) {
        applyWallet(player, live);
      }
    }

    refreshHouseStoreLabel(houseId);
    clearPending(player);
    if (isPlayerActive(player)) {
      player.sendClientMessage(
        Color.info,
        `Вы взяли из шкафа: ${formatMoney(amount)}.`
      );
    }
    return;
  }

  const stockHave =
    item === "ammo"
      ? house.storeAmmo
      : item === "metal"
        ? house.storeMetal
        : house.storeDrugs;
  if (stockHave < amount) {
    player.sendClientMessage(Color.error, `В шкафу недостаточно: ${ITEM_LABEL[item]}.`);
    showAmountDialog(player, "take", item, houseId);
    return;
  }

  const nextDrugs = item === "drugs" ? account.drugs + amount : account.drugs;
  const nextAmmo = item === "ammo" ? account.ammo + amount : account.ammo;
  const nextMetal = item === "metal" ? account.metal + amount : account.metal;
  if (
    !Number.isSafeInteger(nextDrugs) ||
    !Number.isSafeInteger(nextAmmo) ||
    !Number.isSafeInteger(nextMetal)
  ) {
    player.sendClientMessage(Color.error, "Слишком большое количество.");
    clearPending(player);
    return;
  }

  if (!(await takeHouseStoreItem(houseId, account.id, item, amount))) {
    player.sendClientMessage(Color.error, `В шкафу недостаточно: ${ITEM_LABEL[item]}.`);
    showAmountDialog(player, "take", item, houseId);
    return;
  }

  try {
    await saveUserInventory(account.id, nextDrugs, nextAmmo, nextMetal);
  } catch {
    await addHouseStoreItem(houseId, account.id, item, amount);
    refreshHouseStoreLabel(houseId);
    player.sendClientMessage(Color.error, "Не удалось сохранить в базу.");
    clearPending(player);
    return;
  }

  if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
    patchAccount(player, { drugs: nextDrugs, ammo: nextAmmo, metal: nextMetal });
  }

  refreshHouseStoreLabel(houseId);
  clearPending(player);
  if (isPlayerActive(player)) {
    player.sendClientMessage(
      Color.info,
      `Вы взяли из шкафа: ${ITEM_LABEL[item]} ${amount} шт.`
    );
  }
}

function clearPending(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingByPlayer.delete(id);
  }
}

function setDialogBusy(player: Player, busy: boolean): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (busy) {
    dialogBusy.add(id);
  } else {
    dialogBusy.delete(id);
  }
}
