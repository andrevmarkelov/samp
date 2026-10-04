import { omp, type Player } from "@omp-node/core";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { getMembership } from "../org";
import { isJailed } from "../prison/sentence";
import { STREET_WORLD } from "../spawn/point";
import { findTurfAtPlayer, isGangOrgId } from "../zones/turf";

export const GANG_DEAL_MIN_PRICE = 1;
export const GANG_DEAL_MAX_PRICE = 50_000;
export const GANG_DEAL_MAX_CASH = 2_147_483_647;
export const GANG_DEAL_OFFER_TTL_MS = 60_000;
export const GANG_DEAL_KEY_YES = 65536;
export const GANG_DEAL_KEY_NO = 131072;

const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_WASTED = 7;

/** Проверки продавца-бандита на своей ганг-зоне. null — ок. */
export function gangSellerGate(player: Player): string | null {
  if (!isAuthenticated(player)) {
    return "Сначала войдите в аккаунт.";
  }

  const account = getAccount(player);
  if (!account) {
    return "Сначала войдите в аккаунт.";
  }

  if (account.hospitalized) {
    return "Сначала пройдите лечение в больнице.";
  }

  if (isJailed(player)) {
    return "В тюрьме команда недоступна.";
  }

  const membership = getMembership(account);
  if (!membership || !isGangOrgId(membership.org.id)) {
    return "Команда доступна только бандам.";
  }

  try {
    if (player.getState() === PLAYER_STATE_WASTED) {
      return "Вы не в игре.";
    }

    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return "Нужно стоять пешком.";
    }

    if (
      player.getVirtualWorld() !== STREET_WORLD ||
      player.getInterior() !== 0
    ) {
      return "Сделка возможна только на улице.";
    }
  } catch {
    return "Не удалось проверить позицию.";
  }

  const turf = findTurfAtPlayer(player);
  if (!turf || turf.orgId !== membership.org.id) {
    return "Продавать можно только на территории своей банды.";
  }

  return null;
}

export function findDealPlayer(slot: number): Player | null {
  try {
    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      return null;
    }

    if (target.isNPC()) {
      return null;
    }

    if (!getAccount(target)) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}

export function dealPairReady(seller: Player, buyer: Player): string | null {
  const sellerBlock = gangSellerGate(seller);
  if (sellerBlock) {
    return sellerBlock;
  }

  const buyerAccount = getAccount(buyer);
  if (!buyerAccount || !isAuthenticated(buyer)) {
    return "Игрок не найден.";
  }

  if (buyerAccount.hospitalized) {
    return "Покупателю нужно лечение.";
  }

  if (isJailed(buyer)) {
    return "Покупатель в тюрьме.";
  }

  try {
    if (buyer.getState() === PLAYER_STATE_WASTED) {
      return "Игрок не в игре.";
    }

    if (buyer.getState() !== PLAYER_STATE_ONFOOT) {
      return "Покупатель должен стоять пешком.";
    }
  } catch {
    return "Игрок не найден.";
  }

  if (!arePlayersNearby(seller, buyer, WHISPER_RADIUS)) {
    return "Игрок слишком далеко.";
  }

  return null;
}

export function tellDeal(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}

export function parseDealOfferArgs(
  args: string
): { slot: number; amount: number; price: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) {
    return null;
  }

  const slot = Number(parts[0]);
  const amount = Number(parts[1]);
  const price = Number(parts[2]);
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    !Number.isInteger(price) ||
    price < GANG_DEAL_MIN_PRICE ||
    price > GANG_DEAL_MAX_PRICE
  ) {
    return null;
  }

  return { slot, amount, price };
}

/** Дельта наличных после успешного transferUserCash (как в /pay). */
export function applyDealCashDelta(player: Player, delta: number): void {
  if (!isPlayerActive(player)) {
    return;
  }

  const live = getAccount(player);
  if (!live) {
    return;
  }

  const next = Math.max(
    0,
    Math.min(GANG_DEAL_MAX_CASH, Math.floor(live.money) + delta)
  );
  patchAccount(player, { money: next });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
}

/** Общий busy для /sellgun и /selldrug (одни и те же слоты). */
const dealBusy = new Set<number>();

export function isDealBusy(...slots: number[]): boolean {
  return slots.some((slot) => dealBusy.has(slot));
}

export function claimDealBusy(...slots: number[]): boolean {
  if (isDealBusy(...slots)) {
    return false;
  }

  for (const slot of slots) {
    dealBusy.add(slot);
  }

  return true;
}

export function releaseDealBusy(...slots: number[]): void {
  for (const slot of slots) {
    dealBusy.delete(slot);
  }
}
