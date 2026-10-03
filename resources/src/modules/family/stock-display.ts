import { Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { getAccount } from "../auth/session";
import { getFamily, listFamilies } from "./catalog";
import {
  familyIdFromVirtualWorld,
  familyVirtualWorld,
  isFamilyVirtualWorld,
} from "./world";

/** Пикап склада в общем интерьере фамильного дома (свой VW у каждой семьи). */
export const FAMILY_STOCK_POINT = {
  x: 199.2969,
  y: -3.6267,
  z: 1500.99,
  interior: 0,
} as const;

const STOCK_PICKUP_MODEL = 19134;
const PICKUP_TYPE = 1;
const LABEL_HEIGHT = 1.2;
const LABEL_DRAW_DISTANCE = 12;
const PICKUP_RADIUS = 1.5;
const LEAVE_RADIUS = 2.8;

type FamilyStock = {
  familyId: number;
  world: number;
  pickup: Pickup;
  label: TextLabel;
};

const stocks = new Map<number, FamilyStock>();

function stockLabelText(familyId: number): string {
  const family = getFamily(familyId);
  const ammo = family?.ammo ?? 0;
  const metal = family?.metal ?? 0;
  const drugs = family?.drugs ?? 0;
  const money = family?.money ?? 0;
  const status = family && !family.isLocked ? "Склад открыт" : "Склад закрыт";

  return (
    `Патроны: ${ammo}\n` +
    `Металл: ${metal}\n` +
    `Наркотики: ${drugs}\n` +
    `Деньги: ${formatMoney(money)}\n\n` +
    status
  );
}

export function startFamilyWarehouseDisplay(): void {
  for (const family of listFamilies()) {
    ensureFamilyStockDisplay(family.id);
  }
}

/** Пикап + лейбл склада в VW семьи. */
export function ensureFamilyStockDisplay(familyId: number): void {
  if (stocks.has(familyId)) {
    return;
  }

  const world = familyVirtualWorld(familyId);
  const pickup = new Pickup(
    STOCK_PICKUP_MODEL,
    PICKUP_TYPE,
    FAMILY_STOCK_POINT.x,
    FAMILY_STOCK_POINT.y,
    FAMILY_STOCK_POINT.z,
    world
  );
  const label = new TextLabel(
    stockLabelText(familyId),
    Color.info,
    FAMILY_STOCK_POINT.x,
    FAMILY_STOCK_POINT.y,
    FAMILY_STOCK_POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );

  stocks.set(familyId, { familyId, world, pickup, label });
}

export function removeFamilyStockDisplay(familyId: number): void {
  const stock = stocks.get(familyId);
  if (!stock) {
    return;
  }

  try {
    stock.pickup.destroy();
  } catch {
    // Уже уничтожен.
  }

  try {
    stock.label.destroy();
  } catch {
    // Уже уничтожен.
  }

  stocks.delete(familyId);
}

export function refreshFamilyWarehouseLabel(familyId: number): void {
  const stock = stocks.get(familyId);
  if (!stock) {
    return;
  }

  try {
    stock.label.updateText(Color.info, stockLabelText(familyId));
  } catch {
    // Лейбл уже уничтожен.
  }
}

/** Игрок у пикапа склада своей семьи. */
export function findFamilyStockAtPlayer(player: Player): boolean {
  try {
    const world = player.getVirtualWorld();
    if (!isFamilyVirtualWorld(world)) {
      return false;
    }
    if (player.getInterior() !== FAMILY_STOCK_POINT.interior) {
      return false;
    }

    const familyId = familyIdFromVirtualWorld(world);
    const account = getAccount(player);
    if (!account || familyId === null || account.familyId !== familyId) {
      return false;
    }

    if (!stocks.has(familyId)) {
      return false;
    }

    const pos = player.getPos();
    const dist = Math.hypot(
      pos.x - FAMILY_STOCK_POINT.x,
      pos.y - FAMILY_STOCK_POINT.y,
      pos.z - FAMILY_STOCK_POINT.z
    );
    return dist <= LEAVE_RADIUS;
  } catch {
    return false;
  }
}

/** Игрок вплотную на пикапе склада (для однократного открытия меню). */
export function isPlayerOnFamilyStockPickup(player: Player): boolean {
  try {
    const world = player.getVirtualWorld();
    if (!isFamilyVirtualWorld(world)) {
      return false;
    }
    if (player.getInterior() !== FAMILY_STOCK_POINT.interior) {
      return false;
    }

    const familyId = familyIdFromVirtualWorld(world);
    const account = getAccount(player);
    if (
      !account ||
      familyId === null ||
      account.familyId !== familyId ||
      !stocks.has(familyId)
    ) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(
        pos.x - FAMILY_STOCK_POINT.x,
        pos.y - FAMILY_STOCK_POINT.y,
        pos.z - FAMILY_STOCK_POINT.z
      ) <= PICKUP_RADIUS
    );
  } catch {
    return false;
  }
}
