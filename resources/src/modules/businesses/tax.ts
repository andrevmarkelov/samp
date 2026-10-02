import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt } from "../spawn/point";
import { refreshBusinessLabel } from "./markers";
import {
  clearBusinessForSale,
  findOwnedBusiness,
  forfeitExpiredBusinesses,
  getBusiness,
  type BusinessRecord,
} from "./repository";
import { clearInsideBusiness, getInsideBusiness } from "./session";
import {
  currentDateLocal,
  rentDaysLeftLabel,
  rentDaysRemaining,
} from "./tax-math";
import { businessVirtualWorld } from "./world";

const TAX_CHECK_MS = 60_000;
const TAX_REMINDER_DAYS = 5;

let lastTaxDate = currentDateLocal();

export function notifyBusinessTaxReminder(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const business = findOwnedBusiness(account.id);
  if (!business) {
    return;
  }

  const daysLeft = rentDaysRemaining(business.taxPaidUntil);
  if (daysLeft === null || daysLeft > TAX_REMINDER_DAYS) {
    return;
  }

  try {
    if (daysLeft === 0) {
      player.sendClientMessage(
        Color.error,
        `Сегодня последний день оплаты бизнеса #${business.id}. Иначе государство заберёт его завтра.`
      );
      player.sendClientMessage(Color.gray, "Оплатите бизнес в банке.");
      return;
    }

    player.sendClientMessage(
      Color.tryOk,
      `До оплаты бизнеса #${business.id} осталось ${daysLeft} ${rentDaysLeftLabel(daysLeft)}.`
    );
    player.sendClientMessage(Color.gray, "Оплатите бизнес в банке.");
  } catch {
    // Игрок уже вышел.
  }
}

export function isTaxCurrent(business: BusinessRecord): boolean {
  if (business.ownerId === null || business.taxPaidUntil === null) {
    return false;
  }

  return business.taxPaidUntil >= currentDateLocal();
}

export function isTaxLastDay(business: BusinessRecord): boolean {
  return business.taxPaidUntil !== null && business.taxPaidUntil === currentDateLocal();
}

export function startBusinessTaxScheduler(): void {
  lastTaxDate = currentDateLocal();
  void runTaxForfeiture("startup");

  setInterval(() => {
    const today = currentDateLocal();
    if (today === lastTaxDate) {
      return;
    }

    lastTaxDate = today;
    void runTaxForfeiture("midnight");
  }, TAX_CHECK_MS);
}

async function runTaxForfeiture(source: "startup" | "midnight"): Promise<void> {
  let businessIds: number[];
  try {
    businessIds = await forfeitExpiredBusinesses();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] налог бизнесов (${source}): ${message}`);
    return;
  }

  if (businessIds.length === 0) {
    return;
  }

  omp.log(`[${SERVER_TAG}] налог бизнесов (${source}): изъято ${businessIds.length}`);

  for (const businessId of businessIds) {
    applyForfeitedBusiness(businessId);
  }
}

export function applyForfeitedBusiness(businessId: number): void {
  const business = getBusiness(businessId);
  if (!business) {
    return;
  }

  const ownerId = business.ownerId;
  clearBusinessForSale(businessId);
  refreshBusinessLabel(businessId);

  if (ownerId !== null) {
    evictPlayersFromBusiness(
      businessId,
      business,
      `Бизнес #${businessId} изъят государством за неуплату.`
    );
    notifyBusinessOwner(
      ownerId,
      businessId,
      `Бизнес #${businessId} изъят государством за неуплату. Компенсация не выплачивается.`
    );
  }
}

function evictPlayersFromBusiness(
  businessId: number,
  business: BusinessRecord,
  message: string
): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    let inside = getInsideBusiness(slotId) === businessId;
    try {
      inside = inside || player.getVirtualWorld() === businessVirtualWorld(businessId);
    } catch {
      if (!inside) {
        return;
      }
    }

    if (!inside) {
      return;
    }

    clearInsideBusiness(slotId);

    try {
      placeAt(player, {
        x: business.entranceX,
        y: business.entranceY,
        z: business.entranceZ,
        angle: 0,
        interior: 0,
        world: STREET_WORLD,
      });
      refreshStreamForPlayer(player);
      player.sendClientMessage(Color.error, message);
    } catch {
      // Игрок уже вышел.
    }
  });
}

function notifyBusinessOwner(ownerId: number, businessId: number, message: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.id !== ownerId) {
      return;
    }

    const slotId = playerId(player);
    if (slotId !== null && getInsideBusiness(slotId) === businessId) {
      return;
    }

    try {
      player.sendClientMessage(Color.error, message);
    } catch {
      // Игрок уже вышел.
    }
  });
}
