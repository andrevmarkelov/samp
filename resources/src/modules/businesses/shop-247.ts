import { Dialog, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { grantWeapon } from "../anticheat/trust";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import {
  getBusiness,
  listBusinesses,
  payBusinessCashShare,
  payBusinessPhonePurchase,
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { getInsideBusiness } from "./session";
import { isShop247Type } from "./types";
import { businessIdFromVirtualWorld, businessVirtualWorld } from "./world";

export const SHOP_247_MENU_DIALOG_ID = 95;

const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const PLAYER_STATE_ONFOOT = 1;
const DIALOG_STYLE_LIST = 2;
const BIZ_SHARE = 0.8;
const WEAPON_CAMERA = 43;
const CAMERA_AMMO = 36;

type ShopItem =
  | { kind: "phone"; name: string; price: number }
  | { kind: "weapon"; name: string; price: number; weaponId: number; ammo: number };

const MENU: readonly ShopItem[] = [
  { kind: "phone", name: "Мобильный телефон", price: 2_000 },
  { kind: "weapon", name: "Фотоаппарат", price: 1_000, weaponId: WEAPON_CAMERA, ammo: CAMERA_AMMO },
];

const standingOn = new Map<number, number>();
const pendingMenu = new Map<number, number>();
const buying = new Set<number>();

export function startShop247(): void {
  setInterval(tickShop247, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== SHOP_247_MENU_DIALOG_ID) {
      return;
    }
    void onMenuResponse(player, Number(response) !== 0, Number(listItem));
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      standingOn.delete(slotId);
      pendingMenu.delete(slotId);
    }
    const account = getAccount(player);
    if (account) {
      buying.delete(account.id);
    }
  });

  const count = listBusinesses().filter(
    (b) => isShop247Type(b.typeId) && hasBuyPickup(b)
  ).length;
  omp.log(`[${SERVER_TAG}] 24/7: точек продажи ${count}`);
}

function hasBuyPickup(business: BusinessRecord): boolean {
  return (
    business.buyPickupX !== null &&
    business.buyPickupY !== null &&
    business.buyPickupZ !== null
  );
}

function tickShop247(): void {
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
      const shop = findShopBuyPickupAt(
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
      openShopMenu(player, shop);
    } catch {
      standingOn.delete(slotId);
    }
  });
}

function findShopBuyPickupAt(
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
    !isShop247Type(business.typeId) ||
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

function openShopMenu(player: Player, shop: BusinessRecord): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (shop.isLocked && shop.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Магазин закрыт.");
    return;
  }

  pendingMenu.set(slotId, shop.id);

  const lines = MENU.map((item) => {
    if (item.kind === "phone") {
      return `${item.name}\t${formatMoney(item.price)}`;
    }
    return `${item.name}\t${formatMoney(item.price)} (${item.ammo} фото)`;
  });

  try {
    Dialog.show(
      player,
      SHOP_247_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      shop.name,
      lines.join("\n"),
      "Купить",
      "Отмена"
    );
  } catch {
    pendingMenu.delete(slotId);
    standingOn.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть витрину.");
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

  await buyShopItem(player, businessId, item);
  standingOn.delete(slotId);
}

async function buyShopItem(
  player: Player,
  businessId: number,
  item: ShopItem
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
  if (!business || !isShop247Type(business.typeId)) {
    player.sendClientMessage(Color.error, "Магазин недоступен.");
    return;
  }

  if (business.isLocked && business.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Магазин закрыт.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }
    const pos = player.getPos();
    const near = findShopBuyPickupAt(
      pos.x,
      pos.y,
      pos.z,
      player.getInterior(),
      player.getVirtualWorld(),
      slotId
    );
    if (!near || near.id !== businessId) {
      player.sendClientMessage(Color.error, "Подойдите к витрине магазина.");
      return;
    }
  } catch {
    return;
  }

  if (item.kind === "phone" && account.phone) {
    player.sendClientMessage(
      Color.error,
      `У вас уже есть телефон. Номер: ${account.phone}.`
    );
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
  try {
    if (item.kind === "phone") {
      await buyPhone(player, account.id, account.name, businessId, item.price);
    } else {
      await buyCamera(player, account.id, account.name, businessId, item);
    }
  } finally {
    buying.delete(account.id);
  }
}

async function buyPhone(
  player: Player,
  userId: number,
  userName: string,
  businessId: number,
  price: number
): Promise<void> {
  let result;
  try {
    result = await payBusinessPhonePurchase(businessId, userId, price, BIZ_SHARE);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] 24/7 телефон biz=${businessId} (${userName}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  if (!result.ok) {
    if (result.reason === "owned") {
      player.sendClientMessage(Color.error, "У вас уже есть телефон.");
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(
        Color.error,
        `Недостаточно наличных. Нужно ${formatMoney(price)}.`
      );
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  setBusinessBalance(businessId, result.balance);

  if (!isPlayerActive(player) || getAccount(player)?.id !== userId) {
    return;
  }

  patchAccount(player, { money: result.cashLeft, phone: result.phone });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  player.sendClientMessage(
    Color.tryOk,
    `Вы купили мобильный телефон за ${formatMoney(price)}. Ваш номер: ${result.phone}.`
  );
}

async function buyCamera(
  player: Player,
  userId: number,
  userName: string,
  businessId: number,
  item: Extract<ShopItem, { kind: "weapon" }>
): Promise<void> {
  let result;
  try {
    result = await payBusinessCashShare(businessId, userId, item.price, BIZ_SHARE);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] 24/7 фото biz=${businessId} (${userName}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
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

  if (!isPlayerActive(player) || getAccount(player)?.id !== userId) {
    return;
  }

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  grantWeapon(player, item.weaponId, item.ammo);
  player.sendClientMessage(
    Color.tryOk,
    `Вы купили фотоаппарат (${item.ammo} фото) за ${formatMoney(item.price)}.`
  );
}
