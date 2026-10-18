import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { claimYnOffer, getYnOfferKind, releaseYnOffer } from "../../shared/yn-offer";
import { grantWeapon, revokeWeapon } from "../anticheat/trust";
import { byGender } from "../auth/gender";
import { getAccount, isAuthenticated } from "../auth/session";
import { isCuffed } from "../cuff";
import { registerCommand } from "../commands/registry";
import { STREET_WORLD } from "../spawn/point";
import type { GameModule } from "../types";

const WEAPON_FLOWERS = 14;
const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 30_000;
const ANIM_SYNC_ALL = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_TYPE = 14;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

const GRAVE = {
  x: 2240.1282,
  y: -84.3532,
  z: 26.4992,
} as const;

/** 1 букет на игрока, только на сессию. */
const owned = new Set<number>();

type GiftOffer = {
  fromSlot: number;
  fromUserId: number;
  toSlot: number;
  toUserId: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const offerByTarget = new Map<number, GiftOffer>();
const targetByGiver = new Map<number, number>();
const graveNoted = new Set<number>();
let bound = false;

export function hasBouquet(player: Player): boolean {
  const id = playerId(player);
  return id !== null && owned.has(id);
}

/** Выдать один букет. false — уже есть или слот пустой. */
export function giveBouquet(player: Player): boolean {
  const id = playerId(player);
  if (id === null || owned.has(id)) {
    return false;
  }

  owned.add(id);
  if (!grantWeapon(player, WEAPON_FLOWERS, 1)) {
    owned.delete(id);
    return false;
  }
  return true;
}

/** Забрать букет и оружие «цветы». */
export function takeBouquet(player: Player): boolean {
  const id = playerId(player);
  if (id === null || !owned.has(id)) {
    return false;
  }

  owned.delete(id);
  revokeWeapon(player, WEAPON_FLOWERS);
  return true;
}

registerCommand("present", "Подарить букет цветов игроку", (player, args) => {
  offerBouquet(player, args);
});

export const flowersModule: GameModule = {
  name: "flowers",
  start() {
    if (bound) {
      return;
    }
    bound = true;

    new Pickup(19135, PICKUP_TYPE, GRAVE.x, GRAVE.y, GRAVE.z, STREET_WORLD);
    new TextLabel(
      "Могила\nВозложить цветы",
      Color.white,
      GRAVE.x,
      GRAVE.y,
      GRAVE.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      STREET_WORLD,
      false
    );

    setInterval(tickGrave, TICK_MS);

    omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
      const pressed = Number(newKeys) & ~Number(oldKeys);
      if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
        return;
      }
      onGiftKey(player, (pressed & KEY_YES) !== 0);
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id === null) {
        return;
      }
      owned.delete(id);
      graveNoted.delete(id);
      cancelGift(id, "Игрок вышел. Предложение букета отменено.");
    });

    omp.on("playerConnect", (player) => {
      const id = playerId(player);
      if (id === null) {
        return;
      }
      owned.delete(id);
      graveNoted.delete(id);
      cancelGift(id, "Предложение букета отменено.");
    });

    omp.on("playerDeath", (player) => {
      const id = playerId(player);
      if (id !== null) {
        cancelGift(id, "Предложение букета отменено.");
      }
    });
  },
};

function offerBouquet(player: Player, args: string): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const raw = args.trim();
  if (!/^\d+$/.test(raw)) {
    player.sendClientMessage(Color.error, "Использование: /present [id]");
    return;
  }

  const targetSlot = Number(raw);
  const fromSlot = playerId(player);
  if (fromSlot === null || !Number.isInteger(targetSlot) || targetSlot < 0) {
    player.sendClientMessage(Color.error, "Использование: /present [id]");
    return;
  }
  if (targetSlot === fromSlot) {
    player.sendClientMessage(Color.error, "Нельзя подарить букет самому себе.");
    return;
  }
  if (!hasBouquet(player)) {
    player.sendClientMessage(Color.error, "У вас нет букета цветов.");
    return;
  }
  if (blocked(player)) {
    player.sendClientMessage(Color.error, "Сейчас подарить букет нельзя.");
    return;
  }

  const target = omp.players.at(targetSlot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не в сети.");
    return;
  }
  if (hasBouquet(target)) {
    player.sendClientMessage(Color.error, "У игрока уже есть букет цветов.");
    return;
  }
  if (blocked(target)) {
    player.sendClientMessage(Color.error, "Этому игроку сейчас нельзя подарить букет.");
    return;
  }

  const fromAccount = getAccount(player);
  const toAccount = getAccount(target);
  if (!fromAccount || !toAccount) {
    return;
  }
  if (getYnOfferKind(targetSlot) !== undefined || offerByTarget.has(targetSlot)) {
    player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return;
  }
  if (!claimYnOffer(targetSlot, "present")) {
    player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  cancelFromGiver(fromSlot, "Предложение букета отменено.");

  const offer: GiftOffer = {
    fromSlot,
    fromUserId: fromAccount.id,
    toSlot: targetSlot,
    toUserId: toAccount.id,
    expiresAt: Date.now() + OFFER_TTL_MS,
    timer: setTimeout(() => expireGift(targetSlot), OFFER_TTL_MS),
  };
  offerByTarget.set(targetSlot, offer);
  targetByGiver.set(fromSlot, targetSlot);

  player.sendClientMessage(Color.info, `Вы предложили букет цветов игроку ${playerChatName(target)}.`);
  target.sendClientMessage(
    Color.info,
    `${playerChatName(player)} хочет подарить вам букет цветов. Нажмите Y — принять, N — отказаться.`
  );
}

function onGiftKey(player: Player, accepted: boolean): void {
  const toSlot = playerId(player);
  if (toSlot === null || getYnOfferKind(toSlot) !== "present") {
    return;
  }

  const offer = offerByTarget.get(toSlot);
  if (!offer) {
    releaseYnOffer(toSlot, "present");
    return;
  }
  if (Date.now() > offer.expiresAt) {
    expireGift(toSlot);
    return;
  }

  clearGift(offer);
  const giver = livePlayer(offer.fromSlot, offer.fromUserId);
  const receiverOk = getAccount(player)?.id === offer.toUserId;

  if (!accepted) {
    tell(player, Color.info, "Вы отказались от букета.");
    if (giver) {
      const verb = byGender(getAccount(player)?.gender ?? null, "отказался", "отказалась");
      tell(giver, Color.info, `${playerChatName(player)} ${verb} от букета.`);
    }
    return;
  }

  if (!receiverOk || !giver || !hasBouquet(giver)) {
    tell(player, Color.error, "Предложение уже неактуально.");
    if (giver) {
      tell(giver, Color.error, "Предложение уже неактуально.");
    }
    return;
  }
  if (hasBouquet(player)) {
    tell(player, Color.error, "У вас уже есть букет цветов.");
    tell(giver, Color.error, "У игрока уже есть букет цветов.");
    return;
  }

  const taken = takeBouquet(giver);
  if (!taken || !giveBouquet(player)) {
    if (taken) {
      giveBouquet(giver);
    }
    tell(player, Color.error, "Не удалось передать букет.");
    tell(giver, Color.error, "Не удалось передать букет.");
    return;
  }

  const verb = byGender(getAccount(giver)?.gender ?? null, "подарил", "подарила");
  tell(giver, Color.tryOk, `Вы подарили букет цветов игроку ${playerChatName(player)}.`);
  tell(player, Color.tryOk, `${playerChatName(giver)} ${verb} вам букет цветов.`);
}

function tickGrave(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    let onSpot = false;
    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT || player.getInterior() !== 0) {
        graveNoted.delete(slot);
        return;
      }
      if (player.getVirtualWorld() !== STREET_WORLD) {
        graveNoted.delete(slot);
        return;
      }
      const pos = player.getPos();
      onSpot =
        Math.hypot(pos.x - GRAVE.x, pos.y - GRAVE.y, pos.z - GRAVE.z) <= PICKUP_RADIUS;
    } catch {
      return;
    }

    if (!onSpot) {
      graveNoted.delete(slot);
      return;
    }
    if (graveNoted.has(slot)) {
      return;
    }
    graveNoted.add(slot);

    if (blocked(player)) {
      player.sendClientMessage(Color.error, "Сейчас возложить цветы нельзя.");
      return;
    }
    if (!hasBouquet(player)) {
      player.sendClientMessage(Color.error, "У вас нет букета цветов.");
      return;
    }
    if (!takeBouquet(player)) {
      return;
    }

    try {
      player.applyAnimation(
        "GRAVEYARD",
        "mrnF_loop",
        4.1,
        false,
        false,
        false,
        false,
        0,
        ANIM_SYNC_ALL
      );
    } catch {
      // Цветы уже отданы, анимация не обязательна для списания.
    }
    player.sendClientMessage(Color.tryOk, "Вы возложили букет цветов на могилу.");
  });
}

function expireGift(toSlot: number): void {
  const offer = offerByTarget.get(toSlot);
  if (!offer) {
    releaseYnOffer(toSlot, "present");
    return;
  }
  clearGift(offer);
  const giver = livePlayer(offer.fromSlot, offer.fromUserId);
  const target = livePlayer(offer.toSlot, offer.toUserId);
  tell(target, Color.gray, "Время предложения букета истекло.");
  tell(giver, Color.gray, "Время предложения букета истекло.");
}

function cancelGift(slot: number, text: string): void {
  const incoming = offerByTarget.get(slot);
  if (incoming) {
    clearGift(incoming);
    tell(livePlayer(incoming.fromSlot, incoming.fromUserId), Color.gray, text);
    tell(livePlayer(incoming.toSlot, incoming.toUserId), Color.gray, text);
  }
  cancelFromGiver(slot, text);
}

function cancelFromGiver(fromSlot: number, text: string): void {
  const toSlot = targetByGiver.get(fromSlot);
  if (toSlot === undefined) {
    return;
  }
  const offer = offerByTarget.get(toSlot);
  if (!offer || offer.fromSlot !== fromSlot) {
    targetByGiver.delete(fromSlot);
    return;
  }
  clearGift(offer);
  tell(livePlayer(offer.fromSlot, offer.fromUserId), Color.gray, text);
  tell(livePlayer(offer.toSlot, offer.toUserId), Color.gray, text);
}

function clearGift(offer: GiftOffer): void {
  clearTimeout(offer.timer);
  offerByTarget.delete(offer.toSlot);
  if (targetByGiver.get(offer.fromSlot) === offer.toSlot) {
    targetByGiver.delete(offer.fromSlot);
  }
  releaseYnOffer(offer.toSlot, "present");
}

function livePlayer(slot: number, userId: number): Player | null {
  const player = omp.players.at(slot);
  if (!player || !isPlayerActive(player) || !isAuthenticated(player)) {
    return null;
  }
  if (getAccount(player)?.id !== userId) {
    return null;
  }
  return player;
}

function blocked(player: Player): boolean {
  const account = getAccount(player);
  if (!account || account.jailSeconds > 0 || account.hospitalized || isCuffed(player)) {
    return true;
  }
  try {
    return player.getHealth() <= 0;
  } catch {
    return true;
  }
}

function tell(player: Player | null, color: number, text: string): void {
  if (!player) {
    return;
  }
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Слот пустой.
  }
}
