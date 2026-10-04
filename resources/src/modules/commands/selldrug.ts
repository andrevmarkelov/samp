import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerChatName, playerId, playerName } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { byGender } from "../auth/gender";
import { saveUserInventory, transferUserCash } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
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
  parseDealOfferArgs,
  releaseDealBusy,
  tellDeal,
} from "./gang-deal";
import { registerCommand } from "./registry";

const USAGE =
  `Использование: /selldrug [id] [кол-во] [цена ${GANG_DEAL_MIN_PRICE}-${GANG_DEAL_MAX_PRICE}]`;

const MAX_DRUG_AMOUNT = 1000;

type PendingDrugOffer = {
  sellerSlot: number;
  sellerAccountId: number;
  buyerSlot: number;
  buyerAccountId: number;
  amount: number;
  price: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const pendingByBuyer = new Map<number, PendingDrugOffer>();

registerCommand(
  "selldrug",
  "Продать наркотики на территории банды",
  (player, args) => {
    const sellerBlock = gangSellerGate(player);
    if (sellerBlock) {
      tellDeal(player, Color.error, sellerBlock);
      return;
    }

    const parsed = parseDealOfferArgs(args);
    if (!parsed || parsed.amount > MAX_DRUG_AMOUNT) {
      tellDeal(player, Color.error, USAGE);
      return;
    }

    const sellerId = playerId(player);
    if (sellerId === null) {
      return;
    }

    if (parsed.slot === sellerId) {
      tellDeal(player, Color.error, "Нельзя продать наркотики себе.");
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

    const sellerAccount = getAccount(player);
    const buyerAccount = getAccount(buyer);
    const buyerId = playerId(buyer);
    if (!sellerAccount || !buyerAccount || buyerId === null) {
      return;
    }

    if (sellerAccount.drugs < parsed.amount) {
      tellDeal(
        player,
        Color.error,
        `Недостаточно наркотиков. У вас: ${sellerAccount.drugs} шт.`
      );
      return;
    }

    const nextBuyerDrugs = buyerAccount.drugs + parsed.amount;
    if (!Number.isSafeInteger(nextBuyerDrugs) || nextBuyerDrugs < buyerAccount.drugs) {
      tellDeal(player, Color.error, "У игрока слишком много наркотиков.");
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

    if (!claimYnOffer(buyerId, "selldrug")) {
      tellDeal(player, Color.error, "У игрока уже есть активное предложение.");
      return;
    }

    pendingByBuyer.set(buyerId, {
      sellerSlot: sellerId,
      sellerAccountId: sellerAccount.id,
      buyerSlot: buyerId,
      buyerAccountId: buyerAccount.id,
      amount: parsed.amount,
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
      `Вы предложили наркотики (${parsed.amount} шт.) игроку ${playerName(buyer)} за ${pretty}.`
    );
    tellDeal(
      buyer,
      Color.white,
      `${playerName(player)} предлагает наркотики (${parsed.amount} шт.) за ${pretty}.`
    );
    tellDeal(
      buyer,
      Color.white,
      "Нажмите {00CC00}Y {FFFFFF}чтобы купить или {FF6600}N {FFFFFF}чтобы отказаться"
    );
  }
);

export function bindSellDrugOffers(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & GANG_DEAL_KEY_YES) === 0 && (pressed & GANG_DEAL_KEY_NO) === 0) {
      return;
    }

    const buyerId = playerId(player);
    if (buyerId === null || getYnOfferKind(buyerId) !== "selldrug") {
      return;
    }

    const offer = pendingByBuyer.get(buyerId);
    if (!offer) {
      releaseYnOffer(buyerId, "selldrug");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      expireOffer(buyerId, offer.buyerAccountId);
      return;
    }

    if (!getAccount(player) || getAccount(player)?.id !== offer.buyerAccountId) {
      clearTimeout(offer.timer);
      pendingByBuyer.delete(buyerId);
      releaseYnOffer(buyerId, "selldrug");
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
      releaseYnOffer(buyerId, "selldrug");
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
          `${playerChatName(player)} ${verb} предложение наркотиков.`
        );
      }
      return;
    }

    if (!sellerOk || !seller) {
      clearTimeout(offer.timer);
      pendingByBuyer.delete(buyerId);
      releaseYnOffer(buyerId, "selldrug");
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

    void completeDrugSale(seller, player, offer).finally(() => {
      releaseDealBusy(buyerId, offer.sellerSlot);
      releaseYnOffer(buyerId, "selldrug");
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

async function completeDrugSale(
  seller: Player,
  buyer: Player,
  offer: PendingDrugOffer
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

  if (sellerAccount.drugs < offer.amount) {
    tellDeal(buyer, Color.error, "У продавца недостаточно наркотиков.");
    tellDeal(seller, Color.error, "Недостаточно наркотиков для сделки.");
    return;
  }

  const nextSellerDrugs = sellerAccount.drugs - offer.amount;
  const nextBuyerDrugs = buyerAccount.drugs + offer.amount;
  if (!Number.isSafeInteger(nextBuyerDrugs) || nextBuyerDrugs < buyerAccount.drugs) {
    tellDeal(buyer, Color.error, "У вас слишком много наркотиков.");
    tellDeal(seller, Color.error, "У покупателя слишком много наркотиков.");
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

  // Сначала деньги (атомарно в БД), потом наркотики — проще откатить инвентарь.
  let paid = false;
  try {
    paid = await transferUserCash(buyerAccount.id, sellerAccount.id, offer.price);
  } catch {
    tellDeal(buyer, Color.error, "Не удалось провести оплату.");
    tellDeal(seller, Color.error, "Не удалось провести оплату.");
    return;
  }

  if (!paid) {
    tellDeal(buyer, Color.error, "Недостаточно наличных.");
    tellDeal(seller, Color.error, "У покупателя недостаточно наличных.");
    return;
  }

  applyDealCashDelta(buyer, -offer.price);
  applyDealCashDelta(seller, offer.price);

  const prevSellerDrugs = sellerAccount.drugs;
  const prevBuyerDrugs = buyerAccount.drugs;
  patchAccount(seller, { drugs: nextSellerDrugs });
  patchAccount(buyer, { drugs: nextBuyerDrugs });

  try {
    const liveSeller = getAccount(seller);
    const liveBuyer = getAccount(buyer);
    if (
      !liveSeller ||
      !liveBuyer ||
      liveSeller.id !== offer.sellerAccountId ||
      liveBuyer.id !== offer.buyerAccountId
    ) {
      throw new Error("accounts gone");
    }

    await saveUserInventory(
      liveSeller.id,
      liveSeller.drugs,
      liveSeller.ammo,
      liveSeller.metal
    );
    await saveUserInventory(
      liveBuyer.id,
      liveBuyer.drugs,
      liveBuyer.ammo,
      liveBuyer.metal
    );
  } catch {
    patchAccount(seller, { drugs: prevSellerDrugs });
    patchAccount(buyer, { drugs: prevBuyerDrugs });
    await persistDrugCounts(seller, buyer, prevSellerDrugs, prevBuyerDrugs);
    await refundCash(seller, buyer, offer.price);
    tellDeal(buyer, Color.error, "Не удалось сохранить сделку. Деньги возвращены.");
    tellDeal(seller, Color.error, "Не удалось сохранить сделку. Деньги возвращены.");
    return;
  }

  const pretty = formatMoney(offer.price);
  tellDeal(
    buyer,
    Color.info,
    `Вы купили наркотики (${offer.amount} шт.) за ${pretty}.`
  );
  tellDeal(
    seller,
    Color.info,
    `Вы продали наркотики (${offer.amount} шт.) игроку ${playerName(buyer)} за ${pretty}.`
  );
}

async function persistDrugCounts(
  seller: Player,
  buyer: Player,
  sellerDrugs: number,
  buyerDrugs: number
): Promise<void> {
  const liveSeller = getAccount(seller);
  const liveBuyer = getAccount(buyer);
  try {
    if (liveSeller) {
      await saveUserInventory(
        liveSeller.id,
        sellerDrugs,
        liveSeller.ammo,
        liveSeller.metal
      );
    }
    if (liveBuyer) {
      await saveUserInventory(
        liveBuyer.id,
        buyerDrugs,
        liveBuyer.ammo,
        liveBuyer.metal
      );
    }
  } catch {
    // Память уже выставлена вызывающим.
  }
}

async function refundCash(
  seller: Player,
  buyer: Player,
  price: number
): Promise<void> {
  const sellerAccount = getAccount(seller);
  const buyerAccount = getAccount(buyer);
  if (!sellerAccount || !buyerAccount) {
    return;
  }

  try {
    const ok = await transferUserCash(sellerAccount.id, buyerAccount.id, price);
    if (ok) {
      applyDealCashDelta(seller, -price);
      applyDealCashDelta(buyer, price);
    }
  } catch {
    // Деньги могли остаться у продавца — лучше, чем тихий fail без попытки.
  }
}

function expireOffer(buyerSlot: number, buyerAccountId: number): void {
  const offer = pendingByBuyer.get(buyerSlot);
  if (!offer || offer.buyerAccountId !== buyerAccountId) {
    return;
  }

  clearTimeout(offer.timer);
  pendingByBuyer.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "selldrug");

  const buyer = findDealPlayer(buyerSlot);
  if (buyer && getAccount(buyer)?.id === buyerAccountId) {
    tellDeal(buyer, Color.error, "Предложение наркотиков истекло.");
  }

  const seller = findDealPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tellDeal(seller, Color.error, "Предложение наркотиков истекло.");
  }
}

function clearBuyerOffer(buyerSlot: number, notify: boolean): void {
  const offer = pendingByBuyer.get(buyerSlot);
  if (!offer) {
    return;
  }

  clearTimeout(offer.timer);
  pendingByBuyer.delete(buyerSlot);
  releaseYnOffer(buyerSlot, "selldrug");

  if (!notify) {
    return;
  }

  const buyer = findDealPlayer(offer.buyerSlot);
  if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
    tellDeal(buyer, Color.error, "Предложение наркотиков отменено.");
  }

  const seller = findDealPlayer(offer.sellerSlot);
  if (seller && getAccount(seller)?.id === offer.sellerAccountId) {
    tellDeal(seller, Color.info, "Предложение наркотиков отменено.");
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
    releaseYnOffer(buyerSlot, "selldrug");

    const buyer = findDealPlayer(buyerSlot);
    if (buyer && getAccount(buyer)?.id === offer.buyerAccountId) {
      tellDeal(buyer, Color.error, "Предложение наркотиков отменено.");
    }
  }
}
