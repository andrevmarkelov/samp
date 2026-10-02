import { Dialog, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { grantArmour, grantWeapon } from "../anticheat/trust";
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
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { getInsideBusiness } from "./session";
import { isAmmuType } from "./types";
import { businessIdFromVirtualWorld, businessVirtualWorld } from "./world";

export const AMMU_MENU_DIALOG_ID = 94;

const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const PLAYER_STATE_ONFOOT = 1;
const DIALOG_STYLE_LIST = 2;
const MAX_ARMOR = 100;
/** Доля выручки на счёт бизнеса. */
const BIZ_SHARE = 0.8;

type AmmuItem =
  | { kind: "armor"; name: string; price: number }
  | { kind: "weapon"; name: string; price: number; weaponId: number; ammo: number };

const MENU: readonly AmmuItem[] = [
  { kind: "armor", name: "Бронежилет", price: 2_500 },
  { kind: "weapon", name: "Desert Eagle", price: 4_500, weaponId: 24, ammo: 49 },
  { kind: "weapon", name: "Shotgun", price: 4_000, weaponId: 25, ammo: 30 },
  { kind: "weapon", name: "UZI", price: 3_000, weaponId: 28, ammo: 100 },
  { kind: "weapon", name: "AK-47", price: 9_000, weaponId: 30, ammo: 90 },
  { kind: "weapon", name: "Rifle", price: 7_000, weaponId: 33, ammo: 30 },
];

const standingOn = new Map<number, number>();
const pendingMenu = new Map<number, number>();
const buying = new Set<number>();

export function startAmmuShops(): void {
  setInterval(tickAmmuShops, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== AMMU_MENU_DIALOG_ID) {
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
    (b) => isAmmuType(b.typeId) && hasBuyPickup(b)
  ).length;
  omp.log(`[${SERVER_TAG}] аммунация: точек продажи ${count}`);
}

function hasBuyPickup(business: BusinessRecord): boolean {
  return (
    business.buyPickupX !== null &&
    business.buyPickupY !== null &&
    business.buyPickupZ !== null
  );
}

function tickAmmuShops(): void {
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
      const interior = player.getInterior();
      const world = player.getVirtualWorld();
      const shop = findAmmuBuyPickupAt(pos.x, pos.y, pos.z, interior, world, slotId);
      if (!shop) {
        standingOn.delete(slotId);
        return;
      }

      if (standingOn.get(slotId) === shop.id) {
        return;
      }

      standingOn.set(slotId, shop.id);
      openAmmuMenu(player, shop);
    } catch {
      standingOn.delete(slotId);
    }
  });
}

function findAmmuBuyPickupAt(
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
    !isAmmuType(business.typeId) ||
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

function openAmmuMenu(player: Player, shop: BusinessRecord): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (!account.licenses.gun) {
    player.sendClientMessage(Color.error, "Для покупки нужна лицензия на оружие.");
    return;
  }

  if (shop.isLocked && shop.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Магазин закрыт.");
    return;
  }

  pendingMenu.set(slotId, shop.id);

  const lines = MENU.map((item) => {
    if (item.kind === "armor") {
      return `${item.name}\t${formatMoney(item.price)}`;
    }
    return `${item.name}\t${formatMoney(item.price)} (${item.ammo} патр.)`;
  });

  try {
    Dialog.show(
      player,
      AMMU_MENU_DIALOG_ID,
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

  await buyAmmuItem(player, businessId, item);
  // После покупки (или отказа) можно снова открыть витрину, не отходя.
  standingOn.delete(slotId);
}

async function buyAmmuItem(
  player: Player,
  businessId: number,
  item: AmmuItem
): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (!account.licenses.gun) {
    player.sendClientMessage(Color.error, "Для покупки нужна лицензия на оружие.");
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !isAmmuType(business.typeId)) {
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
    const near = findAmmuBuyPickupAt(
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
    omp.log(`[${SERVER_TAG}] аммунация biz=${businessId} (${account.name}): ${message}`);
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

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  if (item.kind === "armor") {
    grantArmour(player, MAX_ARMOR);
    player.sendClientMessage(
      Color.tryOk,
      `Вы купили бронежилет за ${formatMoney(item.price)}.`
    );
    return;
  }

  grantWeapon(player, item.weaponId, item.ammo);
  player.sendClientMessage(
    Color.tryOk,
    `Вы купили ${item.name} (${item.ammo} патр.) за ${formatMoney(item.price)}.`
  );
}
