import { omp, type Player } from "@omp-node/core";
import { Color } from "./colors";
import { WHISPER_RADIUS, arePlayersNearby } from "./nearby";
import { isPlayerActive, playerId, playerName } from "./player";
import { getAccount } from "../modules/auth/session";
import { claimYnOffer, getYnOfferKind, releaseYnOffer, type YnOfferKind } from "./yn-offer";

export type DocShowKind = "pass" | "lic" | "show_medcard" | "vbilet";

const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 60_000;

const DOC_LABEL: Record<DocShowKind, string> = {
  pass: "паспорт",
  lic: "лицензии",
  show_medcard: "медкарту",
  vbilet: "военный билет",
};

type DocShowOffer = {
  kind: DocShowKind;
  fromSlot: number;
  fromUserId: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

type ShowHandler = (viewer: Player, owner: Player) => void;

const pendingByTarget = new Map<number, DocShowOffer>();
const handlers = new Map<DocShowKind, ShowHandler>();
let bound = false;

/** Зарегистрировать обработчик показа документа после Y. */
export function registerDocShowHandler(kind: DocShowKind, handler: ShowHandler): void {
  handlers.set(kind, handler);
  ensureBound();
}

/**
 * Предложить показ документа. false — у цели уже есть оффер или нет слота.
 * Nearby/auth проверяет вызывающий.
 */
export function offerDocShow(
  from: Player,
  to: Player,
  kind: DocShowKind,
  fromUserId: number
): boolean {
  const targetSlot = playerId(to);
  const fromSlot = playerId(from);
  if (targetSlot === null || fromSlot === null) {
    return false;
  }

  if (!claimYnOffer(targetSlot, kind as YnOfferKind)) {
    from.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return false;
  }

  const label = DOC_LABEL[kind];
  const timer = setTimeout(() => {
    expireOffer(targetSlot);
  }, OFFER_TTL_MS);

  pendingByTarget.set(targetSlot, {
    kind,
    fromSlot,
    fromUserId,
    expiresAt: Date.now() + OFFER_TTL_MS,
    timer,
  });

  from.sendClientMessage(
    Color.gray,
    `Вы предложили показать ${label}: ${playerName(to)}.`
  );
  to.sendClientMessage(
    Color.white,
    `${playerName(from)} предлагает показать вам ${label}.`
  );
  to.sendClientMessage(
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы посмотреть или {FF6600}N {FFFFFF}для отказа"
  );
  return true;
}

function ensureBound(): void {
  if (bound) {
    return;
  }
  bound = true;

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    const kind = getYnOfferKind(slot);
    if (
      kind !== "pass" &&
      kind !== "lic" &&
      kind !== "show_medcard" &&
      kind !== "vbilet"
    ) {
      return;
    }

    const offer = pendingByTarget.get(slot);
    if (!offer) {
      releaseYnOffer(slot, kind);
      return;
    }

    if (Date.now() > offer.expiresAt) {
      expireOffer(slot);
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

    if (pendingByTarget.has(slot)) {
      clearOffer(slot);
    }

    for (const [targetSlot, offer] of pendingByTarget) {
      if (offer.fromSlot === slot) {
        clearOffer(targetSlot);
        const target = omp.players.at(targetSlot);
        if (target && isPlayerActive(target)) {
          target.sendClientMessage(Color.error, "Предложение отменено.");
        }
      }
    }
  });
}

function acceptOffer(viewer: Player, targetSlot: number, offer: DocShowOffer): void {
  clearOffer(targetSlot);

  const owner = omp.players.at(offer.fromSlot);
  if (!owner || !isPlayerActive(owner)) {
    viewer.sendClientMessage(Color.error, "Игрок уже не в сети.");
    return;
  }

  if (getAccount(owner)?.id !== offer.fromUserId) {
    viewer.sendClientMessage(Color.error, "Предложение уже неактуально.");
    return;
  }

  if (!arePlayersNearby(viewer, owner, WHISPER_RADIUS)) {
    viewer.sendClientMessage(Color.error, "Игрок слишком далеко.");
    owner.sendClientMessage(
      Color.error,
      `${playerName(viewer)} не смог посмотреть: слишком далеко.`
    );
    return;
  }

  const handler = handlers.get(offer.kind);
  if (!handler) {
    return;
  }

  handler(viewer, owner);
}

function refuseOffer(viewer: Player, targetSlot: number, offer: DocShowOffer): void {
  clearOffer(targetSlot);
  viewer.sendClientMessage(Color.info, "Вы отказались смотреть.");

  const owner = omp.players.at(offer.fromSlot);
  if (owner && isPlayerActive(owner) && getAccount(owner)?.id === offer.fromUserId) {
    owner.sendClientMessage(
      Color.info,
      `${playerName(viewer)} отказался смотреть ${DOC_LABEL[offer.kind]}.`
    );
  }
}

function expireOffer(targetSlot: number): void {
  const offer = pendingByTarget.get(targetSlot);
  if (!offer) {
    return;
  }

  clearOffer(targetSlot);

  const target = omp.players.at(targetSlot);
  if (target && isPlayerActive(target)) {
    target.sendClientMessage(Color.error, "Предложение истекло.");
  }

  const owner = omp.players.at(offer.fromSlot);
  if (owner && isPlayerActive(owner) && getAccount(owner)?.id === offer.fromUserId) {
    owner.sendClientMessage(Color.error, "Предложение истекло.");
  }
}

function clearOffer(targetSlot: number): void {
  const offer = pendingByTarget.get(targetSlot);
  if (!offer) {
    releaseYnOffer(targetSlot);
    return;
  }

  clearTimeout(offer.timer);
  pendingByTarget.delete(targetSlot);
  releaseYnOffer(targetSlot, offer.kind);
}
