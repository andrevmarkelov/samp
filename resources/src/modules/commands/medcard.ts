import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { offerDocShow, registerDocShowHandler } from "../../shared/doc-show-offer";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { byGender } from "../auth/gender";
import { saveUserMedcard, saveUserMoney } from "../auth/repository";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
  type Account,
} from "../auth/session";
import { ORG_HOSPITAL_ID, getMembership } from "../org";
import { HOSPITAL_WORLD } from "../spawn/point";
import { registerCommand } from "./registry";

export const MEDCARD_DIALOG_ID = 68;

const DIALOG_STYLE_MSGBOX = 0;
const ISSUE_MIN_RANK = 6;
const MIN_PRICE = 2000;
const MAX_PRICE = 5000;
const ISSUE_RADIUS = 20;
const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 60_000;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

/** Зона выдачи медкарт в больнице (весь служебный блок ~20 м). */
const ISSUE_POINT = {
  x: 1165.0743,
  y: -1350.3879,
  z: 4001.1001,
} as const;

type MedcardOffer = {
  issuerId: number;
  issuerUserId: number;
  price: number;
  expiresAt: number;
};

/** Предложения медкарты: slot цели → оффер. */
const pendingOffers = new Map<number, MedcardOffer>();

registerDocShowHandler("show_medcard", (viewer, owner) => {
  const account = getAccount(owner);
  if (!account?.medcard) {
    viewer.sendClientMessage(Color.error, "У игрока нет медицинской карты.");
    return;
  }

  showMedcard(viewer, account);
  const verb = byGender(account.gender, "показал", "показала");
  owner.sendClientMessage(Color.gray, `Вы ${verb} медкарту: ${playerName(viewer)}.`);
  viewer.sendClientMessage(Color.gray, `${account.name} ${verb} вам медкарту.`);
});

registerCommand("medcard", "Медкарта: посмотреть или показать по id", (player, args) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войдите в аккаунт.");
    return;
  }

  if (!account.medcard) {
    player.sendClientMessage(Color.error, "У вас нет медицинской карты.");
    return;
  }

  const rawId = args.trim();
  if (!rawId) {
    showMedcard(player, account);
    return;
  }

  const slot = Number(rawId);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /medcard [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    showMedcard(player, account);
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  offerDocShow(player, target, "show_medcard", account.id);
});

registerCommand(
  "givemedcard",
  "Выдать медкарту (Больница, ранг 6+)",
  (player, args) => {
    const account = getAccount(player);
    const membership = account ? getMembership(account) : null;
    if (
      !account ||
      !membership ||
      membership.org.id !== ORG_HOSPITAL_ID ||
      membership.rank.id < ISSUE_MIN_RANK
    ) {
      player.sendClientMessage(
        Color.error,
        "Выдавать медкарту может сотрудник больницы с ранга 6 и выше."
      );
      return;
    }

    if (!isInMedcardIssueZone(player)) {
      player.sendClientMessage(
        Color.error,
        "Выдавать медкарту можно только в больнице."
      );
      return;
    }

    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) {
      player.sendClientMessage(
        Color.error,
        `Использование: /givemedcard [id] [сумма ${MIN_PRICE}-${MAX_PRICE}]`
      );
      return;
    }

    const slot = Number(parts[0]);
    const price = Math.floor(Number(parts[1]));
    if (!Number.isInteger(slot) || slot < 0) {
      player.sendClientMessage(Color.error, "Неверный id игрока.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      !Number.isSafeInteger(price) ||
      price < MIN_PRICE ||
      price > MAX_PRICE
    ) {
      player.sendClientMessage(
        Color.error,
        `Сумма должна быть от $${MIN_PRICE} до $${MAX_PRICE}.`
      );
      return;
    }

    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    const issuerSlot = playerId(player);
    const targetSlot = playerId(target);
    if (issuerSlot === null || targetSlot === null) {
      return;
    }

    if (targetSlot === issuerSlot) {
      player.sendClientMessage(Color.error, "Нельзя выдать медкарту себе.");
      return;
    }

    if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
      player.sendClientMessage(Color.error, "Игрок слишком далеко.");
      return;
    }

    const targetAccount = getAccount(target);
    if (!targetAccount) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (targetAccount.medcard) {
      player.sendClientMessage(Color.error, "У игрока уже есть медицинская карта.");
      return;
    }

    if (targetAccount.money < price) {
      player.sendClientMessage(
        Color.error,
        `У игрока недостаточно денег. Нужно $${price}.`
      );
      return;
    }

    if (pendingOffers.has(targetSlot) || !claimYnOffer(targetSlot, "medcard")) {
      player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
      return;
    }

    pendingOffers.set(targetSlot, {
      issuerId: issuerSlot,
      issuerUserId: account.id,
      price,
      expiresAt: Date.now() + OFFER_TTL_MS,
    });

    player.sendClientMessage(
      Color.info,
      `Вы предложили медкарту игроку ${playerName(target)} за $${price}.`
    );
    target.sendClientMessage(
      Color.white,
      `${playerName(player)} предлагает медкарту за $${price}.`
    );
    target.sendClientMessage(
      Color.white,
      "Нажмите {00CC00}Y {FFFFFF}для просмотра или {FF6600}N {FFFFFF}для отказа"
    );
  }
);

export function bindMedcardOffers(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const slot = playerId(player);
    if (slot === null || getYnOfferKind(slot) !== "medcard") {
      return;
    }

    const offer = pendingOffers.get(slot);
    if (!offer) {
      releaseYnOffer(slot, "medcard");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      pendingOffers.delete(slot);
      releaseYnOffer(slot, "medcard");
      player.sendClientMessage(Color.error, "Предложение медкарты истекло.");
      return;
    }

    if ((pressed & KEY_NO) !== 0) {
      refuseOffer(player, slot, offer);
      return;
    }

    if ((pressed & KEY_YES) !== 0) {
      acceptOffer(player, slot, offer);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    if (pendingOffers.has(slot)) {
      pendingOffers.delete(slot);
      releaseYnOffer(slot, "medcard");
    }
    for (const [targetSlot, offer] of pendingOffers) {
      if (offer.issuerId === slot) {
        pendingOffers.delete(targetSlot);
        releaseYnOffer(targetSlot, "medcard");
      }
    }
  });
}

function acceptOffer(target: Player, targetSlot: number, offer: MedcardOffer): void {
  pendingOffers.delete(targetSlot);
  releaseYnOffer(targetSlot, "medcard");

  const targetAccount = getAccount(target);
  if (!targetAccount || !isAuthenticated(target)) {
    return;
  }

  if (targetAccount.medcard) {
    target.sendClientMessage(Color.error, "У вас уже есть медицинская карта.");
    return;
  }

  const issuer = omp.players.at(offer.issuerId);
  if (!issuer || !isPlayerActive(issuer) || !isAuthenticated(issuer)) {
    target.sendClientMessage(Color.error, "Врач вышел из игры. Сделка отменена.");
    return;
  }

  const issuerAccount = getAccount(issuer);
  if (!issuerAccount || issuerAccount.id !== offer.issuerUserId) {
    target.sendClientMessage(Color.error, "Врач вышел из игры. Сделка отменена.");
    return;
  }

  if (!arePlayersNearby(target, issuer, WHISPER_RADIUS)) {
    target.sendClientMessage(Color.error, "Врач слишком далеко. Сделка отменена.");
    issuer.sendClientMessage(Color.error, "Пациент слишком далеко. Сделка отменена.");
    return;
  }

  if (!isInMedcardIssueZone(issuer)) {
    target.sendClientMessage(Color.error, "Врач должен быть в больнице. Сделка отменена.");
    issuer.sendClientMessage(Color.error, "Выдавайте медкарту только в больнице.");
    return;
  }

  const price = offer.price;
  if (targetAccount.money < price) {
    target.sendClientMessage(Color.error, `Недостаточно денег. Нужно $${price}.`);
    issuer.sendClientMessage(
      Color.error,
      `${playerName(target)} не смог оплатить медкарту ($${price}).`
    );
    return;
  }

  const nextTargetMoney = targetAccount.money - price;
  const nextIssuerMoney = issuerAccount.money + price;
  if (!Number.isSafeInteger(nextIssuerMoney)) {
    target.sendClientMessage(Color.error, "Не удалось провести оплату.");
    return;
  }

  patchAccount(target, { money: nextTargetMoney, medcard: true });
  patchAccount(issuer, { money: nextIssuerMoney });

  const liveTarget = getAccount(target);
  const liveIssuer = getAccount(issuer);
  if (liveTarget) {
    applyWallet(target, liveTarget);
  }
  if (liveIssuer) {
    applyWallet(issuer, liveIssuer);
  }

  void Promise.all([
    saveUserMoney(targetAccount.id, nextTargetMoney, targetAccount.bank),
    saveUserMoney(issuerAccount.id, nextIssuerMoney, issuerAccount.bank),
    saveUserMedcard(targetAccount.id, true),
  ]).catch(() => {
    // Кэш уже обновлён.
  });

  issuer.sendClientMessage(
    Color.info,
    `Игрок ${playerName(target)} купил медкарту за $${price}.`
  );
  target.sendClientMessage(
    Color.info,
    `Вы купили медкарту за $${price}. Посмотреть: /medcard`
  );
  showMedcard(target, getAccount(target) ?? { ...targetAccount, medcard: true });
}

function refuseOffer(target: Player, targetSlot: number, offer: MedcardOffer): void {
  pendingOffers.delete(targetSlot);
  releaseYnOffer(targetSlot, "medcard");
  target.sendClientMessage(Color.gray, "Вы отказались от медкарты.");

  const issuer = omp.players.at(offer.issuerId);
  if (issuer && isPlayerActive(issuer)) {
    issuer.sendClientMessage(
      Color.gray,
      `${playerName(target)} отказался от медкарты.`
    );
  }
}

function isInMedcardIssueZone(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== HOSPITAL_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(pos.x - ISSUE_POINT.x, pos.y - ISSUE_POINT.y, pos.z - ISSUE_POINT.z) <=
      ISSUE_RADIUS
    );
  } catch {
    return false;
  }
}

function showMedcard(viewer: Player, owner: Account): void {
  const body = [
    row("Имя", owner.name),
    row("Статус", "Медицинская карта оформлена"),
    row("Годность", "Годен"),
  ].join("\n");

  try {
    Dialog.show(
      viewer,
      MEDCARD_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Медкарта ${owner.name}`,
      body,
      "Закрыть",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Не удалось открыть медкарту.");
  }
}

function row(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}
