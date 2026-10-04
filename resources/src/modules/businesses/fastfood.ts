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
import {
  getBusiness,
  listBusinesses,
  payBusinessCashShare,
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { getInsideBusiness } from "./session";
import { isFastfoodType } from "./types";
import { businessIdFromVirtualWorld, businessVirtualWorld } from "./world";

export const FASTFOOD_MENU_DIALOG_ID = 98;

const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const PLAYER_STATE_ONFOOT = 1;
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

/** Дороже и сытнее, чем уличный ларёк. */
const MENU: readonly FoodItem[] = [
  { name: "Кола", price: 80, hunger: 15 },
  { name: "Картофель фри", price: 150, hunger: 30 },
  { name: "Хот-дог", price: 180, hunger: 40 },
  { name: "Бургер", price: 280, hunger: 55 },
  { name: "Чизбургер", price: 350, hunger: 65 },
  { name: "Пицца", price: 450, hunger: 80 },
  { name: "Комбо-обед", price: 600, hunger: 100 },
];

const standingOn = new Map<number, number>();
const pendingMenu = new Map<number, number>();
const buying = new Set<number>();
const eatTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function startFastfoodShops(): void {
  setInterval(tickFastfood, TICK_MS);

  omp.on("playerConnect", (player) => {
    preloadEatAnim(player);
  });

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== FASTFOOD_MENU_DIALOG_ID) {
      return;
    }
    void onMenuResponse(player, Number(response) !== 0, Number(listItem));
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      standingOn.delete(slotId);
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

  const count = listBusinesses().filter(
    (b) => isFastfoodType(b.typeId) && hasBuyPickup(b)
  ).length;
  omp.log(`[${SERVER_TAG}] закусочные: точек продажи ${count}`);
}

function hasBuyPickup(business: BusinessRecord): boolean {
  return (
    business.buyPickupX !== null &&
    business.buyPickupY !== null &&
    business.buyPickupZ !== null
  );
}

function tickFastfood(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(slotId);
        return;
      }

      const pos = player.getPos();
      const shop = findBuyPickupAt(
        pos.x,
        pos.y,
        pos.z,
        player.getInterior(),
        player.getVirtualWorld(),
        slotId
      );
      if (!shop) {
        standingOn.delete(slotId);
        return;
      }

      if (standingOn.get(slotId) === shop.id) {
        return;
      }

      standingOn.set(slotId, shop.id);
      openMenu(player, shop);
    } catch {
      standingOn.delete(slotId);
    }
  });
}

function findBuyPickupAt(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  slotId: number
): BusinessRecord | null {
  const businessId = businessIdFromVirtualWorld(world);
  if (businessId === null) {
    return null;
  }

  const sessionId = getInsideBusiness(slotId);
  if (sessionId !== null && sessionId !== businessId) {
    return null;
  }

  const business = getBusiness(businessId);
  if (
    !business ||
    !isFastfoodType(business.typeId) ||
    !hasBuyPickup(business) ||
    interior !== business.interiorId ||
    world !== businessVirtualWorld(business.id)
  ) {
    return null;
  }

  const dist = Math.hypot(
    x - (business.buyPickupX as number),
    y - (business.buyPickupY as number),
    z - (business.buyPickupZ as number)
  );
  if (dist > PICKUP_RADIUS) {
    return null;
  }

  return business;
}

function openMenu(player: Player, shop: BusinessRecord): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (shop.isLocked && shop.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Закусочная закрыта.");
    return;
  }

  pendingMenu.set(slotId, shop.id);

  const lines = [
    "Блюдо\tЦена",
    ...MENU.map((item) => `${item.name}\t${formatMoney(item.price)}`),
  ];

  try {
    Dialog.show(
      player,
      FASTFOOD_MENU_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      shop.name,
      lines.join("\n"),
      "Купить",
      "Отмена"
    );
  } catch {
    pendingMenu.delete(slotId);
    standingOn.delete(slotId);
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
    // standingOn остаётся — меню не всплывёт снова, можно отойти от стойки.
    return;
  }

  const item = MENU[listItem];
  if (!item) {
    return;
  }

  await buyFood(player, businessId, item);
  // После покупки sticky тоже держим: отойти свободно; ещё заказ — отойти и снова встать.
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
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !isFastfoodType(business.typeId) || !hasBuyPickup(business)) {
    player.sendClientMessage(Color.error, "Закусочная недоступна.");
    return;
  }

  if (business.isLocked && business.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Закусочная закрыта.");
    return;
  }

  if (!isAtBuyPickup(player, business)) {
    player.sendClientMessage(Color.error, "Подойдите к стойке.");
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
    omp.log(`[${SERVER_TAG}] закусочная biz=${businessId} (${account.name}): ${message}`);
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

  // После await могли отойти — деньги уже списаны, еду всё равно выдаём.
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

function isAtBuyPickup(player: Player, business: BusinessRecord): boolean {
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }

    if (
      player.getInterior() !== business.interiorId ||
      player.getVirtualWorld() !== businessVirtualWorld(business.id)
    ) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(
        pos.x - (business.buyPickupX as number),
        pos.y - (business.buyPickupY as number),
        pos.z - (business.buyPickupZ as number)
      ) <= PICKUP_RADIUS
    );
  } catch {
    return false;
  }
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
