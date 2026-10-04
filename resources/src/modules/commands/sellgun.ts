import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerChatName, playerId, playerName } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { weaponSlot } from "../anticheat/codes";
import { grantWeapon, revokeWeapon } from "../anticheat/trust";
import { byGender } from "../auth/gender";
import { transferUserCash } from "../auth/repository";
import { getAccount } from "../auth/session";
import {
  GANG_DEAL_KEY_NO,
  GANG_DEAL_KEY_YES,
  GANG_DEAL_MAX_CASH,
  GANG_DEAL_MAX_PRICE,
  GANG_DEAL_MIN_PRICE,
  GANG_DEAL_OFFER_TTL_MS,
  applyDealCashDelta,
  claimDealBusy,
  dealPairReady,
  findDealPlayer,
  gangSellerGate,
  isDealBusy,
  releaseDealBusy,
  tellDeal,
} from "./gang-deal";
import { registerCommand } from "./registry";

const USAGE =
  `Использование: /sellgun [id] [патроны 1-500] [цена ${GANG_DEAL_MIN_PRICE}-${GANG_DEAL_MAX_PRICE}]`;

const MAX_AMMO = 500;

/** Оружие из /makegun — только его можно продавать. */
const SELLABLE_GUNS: ReadonlyMap<number, string> = new Map([
  [24, "Desert Eagle"],
  [30, "AK-47"],
  [31, "M4"],
  [25, "Shotgun"],
  [23, "SD Pistol"],
  [29, "MP5"],
  [34, "Sniper Rifle"],
]);

type PendingGunOffer = {
  sellerSlot: number;
  sellerAccountId: number;
  buyerSlot: number;
  buyerAccountId: number;
  weaponId: number;
  weaponLabel: string;
  ammo: number;
  price: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

type SlotSnap = { weaponId: number; ammo: number };

const pendingByBuyer = new Map<number, PendingGunOffer>();

registerCommand(
  "sellgun",
  "Продать оружие в руках на территории банды",
  (player, args) => {
    const sellerBlock = gangSellerGate(player);
    if (sellerBlock) {
      tellDeal(player, Color.error, sellerBlock);
      return;
    }

    const parsed = parseGunArgs(args);
    if (!parsed) {
      tellDeal(player, Color.error, USAGE);
      return;
    }

    const sellerId = playerId(player);
    if (sellerId === null) {
      return;
    }

    if (parsed.slot === sellerId) {
      tellDeal(player, Color.error, "Нельзя продать оружие себе.");
      return;
    }

    const buyer = findDealPlayer(parsed.slot);
    if (!buyer) {
      tellDeal(player, Color.error, "Игрок не найден.");
      return;
    }

    const pairBlock = dealPairReady(player, buyer);
    if (pairBlock) {
      tellDeal(player, Color.error, pairBlock);
      return;
    }

    const held = readHeldSellableGun(player);
    if (!held) {
      tellDeal(
        player,
        Color.error,
        "Возьмите в руки продаваемое оружие (Deagle, AK, M4, Shotgun, SD, MP5, Sniper)."
      );
      return;
    }

    if (parsed.ammo > held.ammo) {
      tellDeal(
        player,
        Color.error,
        `Недостаточно патронов в оружии. Сейчас: ${held.ammo}.`
      );
      return;
    }

    const buyerAccount = getAccount(buyer);
    const sellerAccount = getAccount(player);
    const buyerId = playerId(buyer);
    if (!buyerAccount || !sellerAccount || buyerId === null) {
      return;
    }

    if (buyerAccount.money < parsed.price) {
      tellDeal(
        player,
        Color.error,
        `У игрока недостаточно наличных. Нужно ${formatMoney(parsed.price)}.`
      );
      return;
    }

    if (isDealBusy(sellerId, buyerId)) {
      tellDeal(player, Color.error, "Подождите завершения предыдущей сделки.");
      return;
    }

    if (pendingByBuyer.has(buyerId) || getYnOfferKind(buyerId) !== undefined) {
      tellDeal(player, Color.error, "У игрока уже есть активное предложение.");
      return;
    }

    cancelOffersFromSeller(sellerId, sellerAccount.id);

    if (!claimYnOffer(buyerId, "sellgun")) {
      tellDeal(player, Color.error, "У игрока уже есть активное предложение.");
      return;
    }

    pendingByBuyer.set(buyerId, {
      sellerSlot: sellerId,
      sellerAccountId: sellerAccount.id,
      buyerSlot: buyerId,
      buyerAccountId: buyerAccount.id,
      weaponId: held.weaponId,
      weaponLabel: held.label,
      ammo: parsed.ammo,
      price: parsed.price,
      expiresAt: Date.now() + GANG_DEAL_OFFER_TTL_MS,
      timer: setTimeout(() => {
        expireOffer(buyerId, buyerAccount.id);
      }, GANG_DEAL_OFFER_TTL_MS),
    });

    const pretty = formatMoney(parsed.price);
    tellDeal(
      player,
      Color.info,
      `Вы предложили ${held.label} (${parsed.ammo} патр.) игроку ${playerName(buyer)} за ${pretty}.`
    );
    tellDeal(
      buyer,
      Color.white,
      `${playerName(player)} предлагает ${held.label} (${parsed.ammo} патр.) за ${pretty}.`
    );
    tellDeal(
      buyer,
      Color.white,
      "Нажмите {00CC00}Y {FFFFFF}чтобы купить или {FF6600}N {FFFFFF}чтобы отказаться"
    );
  }
);

export function bindSellGunOffers(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & GANG_DEAL_KEY_YES) === 0 && (pressed & GANG_DEAL_KEY_NO) === 0) {
      return;
    }

    const buyerId = playerId(player);
    if (buyerId === null || getYnOfferKind(buyerId) !== "sellgun") {
      return;
    }

    const offer = pendingByBuyer.get(buyerId);
    if (!offer) {
      releaseYnOffer(buyerId, "sellgun");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      expireOffer(buyerId, offer.buyerAccountId);
      return;
    }

    if (!getAccount(player) || getAccount(player)?.id !== offer.buyerAccountId) {
      clearTimeout(offer.timer);
      pendingByBuyer.delete(buyerId);
      releaseYnOffer(buyerId, "sellgun");
      return;
    }

    const seller = findDealPlayer(offer.sellerSlot);
    const sellerOk =
      !!seller &&
      getAccount(seller)?.id === offer.sellerAccountId &&
      isPlayerActive(seller);
    const accepted = (pressed & GANG_DEAL_KEY_YES) !== 0;

    if (!accepted) {
      clearTimeout(offer.timer);
      pendingByBuyer.delete(buyerId);
      releaseYnOffer(buyerId, "sellgun");
      tellDeal(player, Color.info, "Вы отклонили предложение.");
      if (sellerOk && seller) {
        const verb = byGender(
          getAccount(player)?.gender ?? null,
          "отклонил",
          "отклонила"
        );
        tellDeal(
          seller,
          Color.info,
          `${playerChatName(player)} ${verb} предложение оружия.`
        );
      }
      return;
    }

    if (!sellerOk || !seller) {
      clearTimeout(offer.timer);
      pendingByBuyer.delete(buyerId);
      releaseYnOffer(buyerId, "sellgun");
      tellDeal(player, Color.error, "Предложение уже неактуально.");
      return;
    }

    if (isDealBusy(buyerId, offer.sellerSlot)) {
      tellDeal(player, Color.error, "Подождите завершения предыдущей сделки.");
      return;
    }

    if (!claimDealBusy(buyerId, offer.sellerSlot)) {
      tellDeal(player, Color.error, "Подождите завершения предыдущей сделки.");
      return;
    }

    clearTimeout(offer.timer);
    pendingByBuyer.delete(buyerId);

    void completeGunSale(seller, player, offer).finally(() => {
      releaseDealBusy(buyerId, offer.sellerSlot);
      releaseYnOffer(buyerId, "sellgun");
    });
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    releaseDealBusy(id);
    clearBuyerOffer(id, true);
    cancelOffersFromSeller(id);
  });
}

async function completeGunSale(
  seller: Player,
  buyer: Player,
  offer: PendingGunOffer
): Promise<void> {
  const blocked = dealPairReady(seller, buyer);
  if (blocked) {
    tellDeal(buyer, Color.error, blocked);
    tellDeal(seller, Color.error, blocked);
    return;
  }

  const sellerAccount = getAccount(seller);
  const buyerAccount = getAccount(buyer);
  if (
    !sellerAccount ||
    !buyerAccount ||
    sellerAccount.id !== offer.sellerAccountId ||
    buyerAccount.id !== offer.buyerAccountId
  ) {
    tellDeal(buyer, Color.error, "Предложение уже неактуально.");
    return;
  }

  let heldWeapon = 0;
  let heldAmmo = 0;
  try {
    heldWeapon = Number(seller.getWeapon());
    heldAmmo = readWeaponAmmo(seller, offer.weaponId);
  } catch {
    tellDeal(buyer, Color.error, "Продавец больше не держит оружие.");
    tellDeal(seller, Color.error, "Возьмите оружие в руки для продажи.");
    return;
  }

  if (heldWeapon !== offer.weaponId || heldAmmo < offer.ammo) {
    tellDeal(buyer, Color.error, "Продавец больше не держит нужное оружие.");
    tellDeal(
      seller,
      Color.error,
      "Сделка отменена: нужно держать то же оружие с достаточным числом патронов."
    );
    return;
  }

  if (buyerAccount.money < offer.price) {
    tellDeal(
      buyer,
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(offer.price)}.`
    );
    tellDeal(seller, Color.error, "У покупателя недостаточно наличных.");
    return;
  }

  if (sellerAccount.money > GANG_DEAL_MAX_CASH - offer.price) {
    tellDeal(buyer, Color.error, "Сделка невозможна: у продавца слишком много наличных.");
    tellDeal(seller, Color.error, "У вас слишком много наличных для этой сделки.");
    return;
  }

  const buyerSnap = readSlotSnap(buyer, offer.weaponId);
  const remaining = heldAmmo - offer.ammo;

  if (!revokeWeapon(seller, offer.weaponId)) {
    tellDeal(buyer, Color.error, "Не удалось забрать оружие у продавца.");
    tellDeal(seller, Color.error, "Не удалось передать оружие.");
    return;
  }

  if (remaining > 0 && !grantWeapon(seller, offer.weaponId, remaining)) {
    restoreSlotWeapon(seller, offer.weaponId, {
      weaponId: offer.weaponId,
      ammo: heldAmmo,
    });
    tellDeal(buyer, Color.error, "Не удалось завершить передачу оружия.");
    tellDeal(seller, Color.error, "Не удалось завершить передачу оружия.");
    return;
  }

  if (!grantWeapon(buyer, offer.weaponId, offer.ammo)) {
    restoreSlotWeapon(buyer, offer.weaponId, buyerSnap);
    restoreSlotWeapon(seller, offer.weaponId, {
      weaponId: offer.weaponId,
      ammo: heldAmmo,
    });
    tellDeal(buyer, Color.error, "Не удалось выдать оружие.");
    tellDeal(seller, Color.error, "Не удалось выдать оружие покупателю.");
    return;
  }

  let ok = false;
  try {
    ok = await transferUserCash(buyerAccount.id, sellerAccount.id, offer.price);
  } catch {
    restoreSlotWeapon(buyer, offer.weaponId, buyerSnap);
    restoreSlotWeapon(seller, offer.weaponId, {
      weaponId: offer.weaponId,
      ammo: heldAmmo,
    });
    tellDeal(buyer, Color.error, "Не удалось провести оплату. Оружие возвращено.");
    tellDeal(seller, Color.error, "Не удалось провести оплату.");
    return;
  }

  if (!ok) {
    restoreSlotWeapon(buyer, offer.weaponId, buyerSnap);
    restoreSlotWeapon(seller, offer.weaponId, {
      weaponId: offer.weaponId,
      ammo: heldAmmo,
    });
    tellDeal(buyer, Color.error, "Недостаточно наличных.");
    tellDeal(seller, Color.error, "У покупателя недостаточно наличных.");
    return;
  }

  applyDealCashDelta(buyer, -offer.price);
  applyDealCashDelta(seller, offer.price);

  const pretty = formatMoney(offer.price);
  tellDeal(
    buyer,
    Color.info,
    `Вы купили ${offer.weaponLabel} (${offer.ammo} патр.) за ${pretty}.`
  );
  tellDeal(
    seller,
    Color.info,
    `Вы продали ${offer.weaponLabel} (${offer.ammo} патр.) игроку ${playerName(buyer)} за ${pretty}.`
  );
}

function parseGunArgs(
  args: string
): { slot: number; ammo: number; price: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) {
    return null;
  }

  const slot = Number(parts[0]);
  const ammo = Number(parts[1]);
  const price = Number(parts[2]);
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    !Number.isInteger(ammo) ||
    ammo < 1 ||
    ammo > MAX_AMMO ||
    !Number.isInteger(price) ||
    price < GANG_DEAL_MIN_PRICE ||
    price > GANG_DEAL_MAX_PRICE
  ) {
    return null;
  }

  return { slot, ammo, price };
}

function readHeldSellableGun(
  player: Player
): { weaponId: number; label: string; ammo: number } | null {
  try {
    const weaponId = Number(player.getWeapon());
    const label = SELLABLE_GUNS.get(weaponId);
    if (!label) {
      return null;
    }

    const ammo = readWeaponAmmo(player, weaponId);
    if (ammo < 1) {
      return null;
    }

    return { weaponId, label, ammo };
  } catch {
    return null;
  }
}

function readWeaponAmmo(player: Player, weaponId: number): number {
  const snap = readSlotSnap(player, weaponId);
  return snap.weaponId === weaponId ? snap.ammo : 0;
}

/** Снимок слота оружия (для отката, если у покупателя уже был ствол в том же слоте). */
function readSlotSnap(player: Player, forWeaponId: number): SlotSnap {
  try {
    const slot = weaponSlot(forWeaponId);
    if (slot < 0) {
      return { weaponId: 0, ammo: 0 };
    }

    const data = player.getWeaponData(slot) as {
      weaponid?: number;
      weapons?: number;
      weapon?: number;
      ammo?: number;
    };
    const weaponId = Number(data.weaponid ?? data.weapons ?? data.weapon ?? 0);
    const ammo = Math.max(0, Math.floor(Number(data.ammo ?? 0)));
    if (weaponId <= 0 || ammo < 0) {
      return { weaponId: 0, ammo: 0 };
    }

    return { weaponId, ammo };
  } catch {
    return { weaponId: 0, ammo: 0 };
  }
}

/**
 * Откат слота: снять выданное оружие и вернуть то, что было до сделки
 * (в т.ч. другой ствол того же слота или прежние патроны).
 */
function restoreSlotWeapon(
  player: Player,
  soldWeaponId: number,
  snap: SlotSnap
): void {
  if (!isPlayerActive(player)) {
    return;
  }

  revokeWeapon(player, soldWeaponId);
  if (snap.weaponId > 0 && snap.weaponId !== soldWeaponId) {
    revokeWeapon(player, snap.weaponId);
  }

  if (snap.weaponId > 0 && snap.ammo > 0) {
    grantWeapon(player, snap.weaponId, snap.ammo);
  }
}

function expireOffer(buyerSlot: number, buyerAccountId: number): void {
  const offer = pendingByBuyer.get(buyerSlot);
  if (!offer || offer.buyerAccountId !== buyerAccountId) {
    return;
  }

  clearTimeout(offer.timer);
  pendingByBuyer.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "sellgun");

  const buyer = findDealPlayer(buyerSlot);
  if (buyer && getAccount(buyer)?.id === buyerAccountId) {
    tellDeal(buyer, Color.error, "Предложение оружия истекло.");
  }

  const seller = findDealPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tellDeal(seller, Color.error, "Предложение оружия истекло.");
  }
}

function clearBuyerOffer(buyerSlot: number, notify: boolean): void {
  const offer = pendingByBuyer.get(buyerSlot);
  if (!offer) {
    return;
  }

  clearTimeout(offer.timer);
  pendingByBuyer.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "sellgun");

  if (!notify) {
    return;
  }

  const buyer = findDealPlayer(offer.buyerSlot);
  if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
    tellDeal(buyer, Color.error, "Предложение оружия отменено.");
  }

  const seller = findDealPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tellDeal(seller, Color.info, "Предложение оружия отменено.");
  }
}

function cancelOffersFromSeller(sellerSlot: number, sellerAccountId?: number): void {
  for (const [buyerSlot, offer] of pendingByBuyer) {
    if (offer.sellerSlot !== sellerSlot) {
      continue;
    }

    if (
      sellerAccountId !== undefined &&
      offer.sellerAccountId !== sellerAccountId
    ) {
      continue;
    }

    clearTimeout(offer.timer);
    pendingByBuyer.delete(buyerSlot);
    releaseYnOffer(buyerSlot, "sellgun");

    const buyer = findDealPlayer(buyerSlot);
    if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
      tellDeal(buyer, Color.error, "Предложение оружия отменено.");
    }
  }
}
