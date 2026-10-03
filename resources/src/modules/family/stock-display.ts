import { Checkpoint, omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import { getFamily, listFamilies } from "./catalog";
import {
  familyIdFromVirtualWorld,
  familyVirtualWorld,
  isFamilyVirtualWorld,
} from "./world";

/** Чекпоинт склада в общем интерьере фамильного дома (свой VW у каждой семьи). */
export const FAMILY_STOCK_POINT = {
  x: 199.2969,
  y: -3.6267,
  z: 1500.99,
  interior: 0,
} as const;

const LABEL_HEIGHT = 1.2;
const LABEL_DRAW_DISTANCE = 12;
const CHECKPOINT_RADIUS = 1.5;
const LEAVE_RADIUS = 2.8;
const SHOW_DISTANCE = 45;
const TICK_MS = 400;

type FamilyStock = {
  familyId: number;
  world: number;
  label: TextLabel;
};

const stocks = new Map<number, FamilyStock>();
const checkpointShown = new Set<number>();

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

  setInterval(tickFamilyWarehouseCheckpoints, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      checkpointShown.delete(id);
    }
  });
}

/** Лейбл + привязка склада к VW семьи (интерьер один на всех). */
export function ensureFamilyStockDisplay(familyId: number): void {
  if (stocks.has(familyId)) {
    return;
  }

  const world = familyVirtualWorld(familyId);
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

  stocks.set(familyId, { familyId, world, label });
}

export function removeFamilyStockDisplay(familyId: number): void {
  const stock = stocks.get(familyId);
  if (!stock) {
    return;
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

/** Игрок на чекпоинте склада своей семьи. */
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

function tickFamilyWarehouseCheckpoints(): void {
  omp.players.forEach((player) => {
    updateCheckpointForPlayer(player);
  });
}

function updateCheckpointForPlayer(player: Player): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player)) {
    return;
  }

  let show = false;
  try {
    if (player.getInterior() === FAMILY_STOCK_POINT.interior) {
      const world = player.getVirtualWorld();
      const familyId = familyIdFromVirtualWorld(world);
      const account = getAccount(player);

      if (
        familyId !== null &&
        account &&
        account.familyId === familyId &&
        stocks.has(familyId)
      ) {
        const pos = player.getPos();
        const dist = Math.hypot(
          pos.x - FAMILY_STOCK_POINT.x,
          pos.y - FAMILY_STOCK_POINT.y,
          pos.z - FAMILY_STOCK_POINT.z
        );
        show = dist <= SHOW_DISTANCE;

        if (show && !checkpointShown.has(id)) {
          Checkpoint.set(
            player,
            FAMILY_STOCK_POINT.x,
            FAMILY_STOCK_POINT.y,
            FAMILY_STOCK_POINT.z,
            CHECKPOINT_RADIUS
          );
          checkpointShown.add(id);
        }
      }
    }
  } catch {
    show = false;
  }

  if (show) {
    return;
  }

  if (!checkpointShown.has(id)) {
    return;
  }

  checkpointShown.delete(id);
  try {
    Checkpoint.disable(player);
  } catch {
    // Игрок уже вышел.
  }
}
