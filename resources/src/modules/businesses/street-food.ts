import { Dialog, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserHunger } from "../auth/repository";
import {
  MAX_HUNGER,
  applyWallet,
  getAccount,
  isAuthenticated,
  normalizeHunger,
  patchAccount,
} from "../auth/session";
import { notifyHungerRestored } from "../persist";
import { STREET_WORLD } from "../spawn/point";
import {
  getBusiness,
  listBusinesses,
  payBusinessCashShare,
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { isStreetFoodType } from "./types";

export const STREET_FOOD_MENU_DIALOG_ID = 93;

/** Левый ALT (KEY_WALK). */
const KEY_WALK = 1024;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const DIALOG_STYLE_TABLIST_HEADERS = 5;
const EAT_SOUND_ID = 32200;
const ANIM_SYNC_ALL = 1;
const EAT_ANIM_MS = 3000;
/** Доля выручки на счёт бизнеса. */
const BIZ_SHARE = 0.8;

type FoodItem = {
  name: string;
  price: number;
  hunger: number;
};

const MENU: readonly FoodItem[] = [
  { name: "Хот-дог", price: 50, hunger: 20 },
  { name: "Бургер", price: 100, hunger: 40 },
];

const nearStall = new Map<number, number>();
const pendingMenu = new Map<number, number>();
const buying = new Set<number>();
const eatTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function startStreetFoodStalls(): void {
  setInterval(tickStreetFood, TICK_MS);

  omp.on("playerConnect", (player) => {
    preloadEatAnim(player);
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_WALK) === 0) {
      return;
    }
    tryOpenMenu(player);
  });

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== STREET_FOOD_MENU_DIALOG_ID) {
      return;
    }
    void onMenuResponse(player, Number(response) !== 0, Number(listItem));
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      nearStall.delete(slotId);
      pendingMenu.delete(slotId);
      const timer = eatTimers.get(slotId);
      if (timer) {
        clearTimeout(timer);
        eatTimers.delete(slotId);
      }
    }
    const account = getAccount(player);
    if (account) {
      buying.delete(account.id);
    }
  });

  const count = listBusinesses().filter((b) => isStreetFoodType(b.typeId)).length;
  omp.log(`[${SERVER_TAG}] уличная еда: ларьков ${count}`);
}

function tickStreetFood(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    try {
      if (
        player.getVirtualWorld() !== STREET_WORLD ||
        player.getInterior() !== 0 ||
        player.getState() !== PLAYER_STATE_ONFOOT
      ) {
        nearStall.delete(slotId);
        return;
      }

      const pos = player.getPos();
      const stall = findStreetFoodAt(pos.x, pos.y, pos.z);
      if (!stall) {
        nearStall.delete(slotId);
        return;
      }

      nearStall.set(slotId, stall.id);
    } catch {
      nearStall.delete(slotId);
    }
  });
}

function findStreetFoodAt(x: number, y: number, z: number): BusinessRecord | null {
  let best: BusinessRecord | null = null;
  let bestDist = PICKUP_RADIUS;

  for (const business of listBusinesses()) {
    if (!isStreetFoodType(business.typeId)) {
      continue;
    }
    const dx = business.entranceX - x;
    const dy = business.entranceY - y;
    const dz = business.entranceZ - z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= bestDist) {
      bestDist = dist;
      best = business;
    }
  }

  return best;
}

function tryOpenMenu(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const slotId = playerId(player);
  const account = getAccount(player);
  if (slotId === null || !account) {
    return;
  }

  const businessId = nearStall.get(slotId);
  if (businessId === undefined) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !isStreetFoodType(business.typeId)) {
    nearStall.delete(slotId);
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return;
    }
  } catch {
    return;
  }

  if (business.isLocked && business.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Ларек закрыт.");
    return;
  }

  pendingMenu.set(slotId, business.id);

  const lines = [
    "Товар\tЦена",
    ...MENU.map((item) => `${item.name}\t${formatMoney(item.price)}`),
  ];

  try {
    Dialog.show(
      player,
      STREET_FOOD_MENU_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      business.name,
      lines.join("\n"),
      "Купить",
      "Отмена"
    );
  } catch {
    pendingMenu.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть меню.");
  }
}

async function onMenuResponse(
  player: Player,
  ok: boolean,
  listItem: number
): Promise<void> {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const businessId = pendingMenu.get(slotId);
  pendingMenu.delete(slotId);
  if (!ok || businessId === undefined) {
    return;
  }

  const item = MENU[listItem];
  if (!item) {
    return;
  }

  await buyFood(player, businessId, item);
}

async function buyFood(
  player: Player,
  businessId: number,
  item: FoodItem
): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !isStreetFoodType(business.typeId)) {
    player.sendClientMessage(Color.error, "Ларек недоступен.");
    return;
  }

  if (business.isLocked && business.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Ларек закрыт.");
    return;
  }

  if (nearStall.get(playerId(player) ?? -1) !== businessId) {
    player.sendClientMessage(Color.error, "Подойдите ближе к ларьку.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }
  } catch {
    return;
  }

  if (account.money < item.price) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(item.price)}.`
    );
    return;
  }

  if (buying.has(account.id)) {
    return;
  }

  buying.add(account.id);
  let result;
  try {
    result = await payBusinessCashShare(businessId, account.id, item.price, BIZ_SHARE);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] уличная еда biz=${businessId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  } finally {
    buying.delete(account.id);
  }

  if (!result.ok) {
    if (result.reason === "funds") {
      player.sendClientMessage(
        Color.error,
        `Недостаточно наличных. Нужно ${formatMoney(item.price)}.`
      );
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  setBusinessBalance(businessId, result.balance);

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  const liveAccount = getAccount(player);
  if (!liveAccount) {
    return;
  }

  const nextHunger = Math.min(
    MAX_HUNGER,
    normalizeHunger(liveAccount.hunger) + item.hunger
  );

  patchAccount(player, { money: result.cashLeft, hunger: nextHunger });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  notifyHungerRestored(player, nextHunger);

  void saveUserHunger(account.id, nextHunger).catch(() => {
    // Периодический save подхватит.
  });

  try {
    const pos = player.getPos();
    player.playGameSound(EAT_SOUND_ID, pos.x, pos.y, pos.z);
  } catch {
    // Слот пустой.
  }

  playEatAnimation(player);

  player.sendClientMessage(
    Color.tryOk,
    `Вы купили ${item.name} за ${formatMoney(item.price)}. Сытость: ${nextHunger}.`
  );
}

function preloadEatAnim(player: Player): void {
  try {
    player.applyAnimation(
      "FOOD",
      "EAT_Burger",
      4.1,
      false,
      false,
      false,
      false,
      1,
      ANIM_SYNC_ALL
    );
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Подтянется при покупке.
  }
}

function playEatAnimation(player: Player): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const prev = eatTimers.get(slotId);
  if (prev) {
    clearTimeout(prev);
  }

  try {
    player.applyAnimation(
      "FOOD",
      "EAT_Burger",
      4.1,
      false,
      false,
      false,
      false,
      0,
      ANIM_SYNC_ALL
    );
  } catch {
    return;
  }

  eatTimers.set(
    slotId,
    setTimeout(() => {
      eatTimers.delete(slotId);
      if (playerId(player) !== slotId) {
        return;
      }
      try {
        player.clearAnimations(ANIM_SYNC_ALL);
      } catch {
        // Уже вышел.
      }
    }, EAT_ANIM_MS)
  );
}
