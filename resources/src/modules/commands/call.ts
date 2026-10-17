import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import {
  CHAT_RADIUS,
  clipClientMessage,
  sendNearby,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated, normalizePhone } from "../auth/session";
import { cancelTalkTimer, playLocalSpeech } from "../chat/talk";
import { registerCommand } from "./registry";

const COLOR_OUT = 0x66cc00ff;
const COLOR_IN = 0x3399ffff;
const COLOR_OWN = 0x999999ff;
const COLOR_OTHER = 0xffff00ff;
const COLOR_END = 0xff9a44ff;
const RING_SOUND = 20600;
const RING_BUBBLE_MS = 3_000;
const RING_BUBBLE = "Звонит телефон";
const ANIM_SYNC_ALL = 1;
const SPECIAL_ACTION_NONE = 0;
/** Встроенное действие телефона: phone_talk и можно идти. */
const SPECIAL_ACTION_USECELLPHONE = 11;

const phoneHolding = new Set<number>();
const previousAction = new Map<number, number>();

type Call = {
  callerSlot: number;
  calleeSlot: number;
  callerUserId: number;
  calleeUserId: number;
  phase: "ringing" | "active";
};

const bySlot = new Map<number, Call>();
let bound = false;

registerCommand("call", "Позвонить по номеру телефона", (player, args) => {
  startCall(player, args);
});

registerCommand("p", "Ответить на звонок", (player) => {
  answerCall(player);
});

registerCommand("h", "Завершить или отклонить звонок", (player) => {
  hangUp(player);
});

export function bindPhoneCalls(): void {
  if (bound) {
    return;
  }
  bound = true;

  omp.on("playerDisconnect", (player) => {
    dropCallSlot(playerId(player));
  });

  omp.on("playerConnect", (player) => {
    dropCallSlot(playerId(player));
  });

  omp.on("playerDeath", (player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }
    const call = bySlot.get(slot);
    if (call) {
      finishCall(call);
    }
  });
}

/** Обычный чат во время разговора уходит собеседнику, а не всем рядом. */
export function routePhoneChat(player: Player, text: string): boolean {
  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return false;
  }

  const call = bySlot.get(slot);
  if (!call || call.phase !== "active" || userIdOf(call, slot) !== account.id) {
    return false;
  }

  const other = livePlayer(partnerSlot(call, slot), partnerUserId(call, slot));
  if (!other) {
    finishCall(call);
    return true;
  }

  const line = clipClientMessage(`[Тел] ${account.name}: ${text}`);
  player.sendClientMessage(COLOR_OWN, line);
  other.sendClientMessage(COLOR_OTHER, line);
  playLocalSpeech(player, clipClientMessage(`(( [тел] ${text} ))`), { anim: false });
  return true;
}

function startCall(player: Player, args: string): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (!account.phone) {
    player.sendClientMessage(Color.error, "У вас нет мобильного телефона. Купите его в 24/7.");
    return;
  }

  const phone = normalizePhone(args.trim().split(/\s+/)[0] ?? "");
  if (!phone) {
    player.sendClientMessage(Color.error, "Использование: /call [номер]");
    return;
  }

  if (phone === account.phone) {
    player.sendClientMessage(Color.error, "Нельзя позвонить самому себе.");
    return;
  }

  if (busyOnLine(slotId, account.id)) {
    player.sendClientMessage(Color.error, "Вы уже на линии. Завершить: /h.");
    return;
  }

  const target = findOnlineByPhone(phone);
  const targetAccount = target ? getAccount(target) : null;
  const targetSlot = target ? playerId(target) : null;
  if (!target || !targetAccount?.phone || targetSlot === null) {
    player.sendClientMessage(Color.error, "Абонент не в сети.");
    return;
  }

  if (busyOnLine(targetSlot, targetAccount.id)) {
    player.sendClientMessage(Color.error, "Абонент занят.");
    return;
  }

  const call: Call = {
    callerSlot: slotId,
    calleeSlot: targetSlot,
    callerUserId: account.id,
    calleeUserId: targetAccount.id,
    phase: "ringing",
  };
  bySlot.set(slotId, call);
  bySlot.set(targetSlot, call);
  holdPhoneAnim(player);

  sendNearby(
    player,
    CHAT_RADIUS,
    Color.action,
    `${playerChatName(player)} достал телефон`
  );
  player.sendClientMessage(
    COLOR_OUT,
    clipClientMessage(
      `Исходящий звонок | Номер: ${phone} {FFCD00}| Ожидание ответа от ${targetAccount.name}...`
    )
  );

  try {
    target.setChatBubble(RING_BUBBLE, Color.action, CHAT_RADIUS, RING_BUBBLE_MS);
  } catch {
    // Надпись над ником не обязательна.
  }

  target.sendClientMessage(
    COLOR_IN,
    clipClientMessage(
      `Входящий звонок | Номер: ${account.phone} | Вызывает ${account.name}`
    )
  );
  target.sendClientMessage(
    Color.white,
    "Используйте {00CC00}/p {FFFFFF}чтобы ответить или {FF6600}/h {FFFFFF}чтобы отклонить вызов."
  );
  playRing(target);
}

function answerCall(player: Player): void {
  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return;
  }

  const call = bySlot.get(slot);
  if (!call || call.phase !== "ringing" || call.calleeSlot !== slot || call.calleeUserId !== account.id) {
    player.sendClientMessage(Color.error, "Вам никто не звонит.");
    return;
  }

  const caller = livePlayer(call.callerSlot, call.callerUserId);
  if (!caller) {
    finishCall(call);
    return;
  }

  call.phase = "active";
  holdPhoneAnim(player);
  player.sendClientMessage(Color.action, "Вы приняли звонок.");
  caller.sendClientMessage(Color.action, `${account.name} ответил на Ваш звонок.`);
}

function hangUp(player: Player): void {
  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return;
  }

  const call = bySlot.get(slot);
  if (!call || userIdOf(call, slot) !== account.id) {
    player.sendClientMessage(Color.error, "Вы не разговариваете по телефону.");
    return;
  }

  finishCall(call);
}

function dropCallSlot(slot: number | null): void {
  if (slot === null) {
    return;
  }

  const call = bySlot.get(slot);
  if (!call) {
    return;
  }

  finishCall(call, slot);
}

function busyOnLine(slot: number, userId: number): boolean {
  const call = bySlot.get(slot);
  if (!call) {
    return false;
  }

  if (userIdOf(call, slot) === userId) {
    return true;
  }

  finishCall(call, slot);
  return false;
}

function finishCall(call: Call, skipSlot?: number): void {
  bySlot.delete(call.callerSlot);
  bySlot.delete(call.calleeSlot);
  releasePhoneAnim(call.callerSlot, call.callerUserId);
  releasePhoneAnim(call.calleeSlot, call.calleeUserId);
  if (skipSlot !== call.callerSlot) {
    tell(call.callerSlot, call.callerUserId, COLOR_END, "Звонок окончен");
  }
  if (skipSlot !== call.calleeSlot) {
    tell(call.calleeSlot, call.calleeUserId, COLOR_END, "Звонок окончен");
  }
}

export function endPhoneCall(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const call = bySlot.get(slot);
  if (!call) {
    return;
  }

  const account = getAccount(player);
  if (account && userIdOf(call, slot) !== account.id) {
    return;
  }

  finishCall(call);
}

function tell(slot: number, userId: number, color: number, text: string): void {
  const player = livePlayer(slot, userId);
  if (!player) {
    return;
  }
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Уже вышел.
  }
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

function userIdOf(call: Call, slot: number): number {
  return call.callerSlot === slot ? call.callerUserId : call.calleeUserId;
}

function partnerSlot(call: Call, slot: number): number {
  return call.callerSlot === slot ? call.calleeSlot : call.callerSlot;
}

function partnerUserId(call: Call, slot: number): number {
  return call.callerSlot === slot ? call.calleeUserId : call.callerUserId;
}

function findOnlineByPhone(phone: string): Player | null {
  let found: Player | null = null;

  omp.players.forEach((other) => {
    if (found || !isPlayerActive(other) || !isAuthenticated(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    if (getAccount(other)?.phone === phone) {
      found = other;
    }
  });

  return found;
}

function holdPhoneAnim(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  cancelTalkTimer(player);
  let restore = SPECIAL_ACTION_NONE;
  try {
    const current = player.getSpecialAction();
    if (current !== SPECIAL_ACTION_USECELLPHONE && current !== SPECIAL_ACTION_NONE) {
      restore = current;
    }
  } catch {
    // Оставим обычную стойку после звонка.
  }

  previousAction.set(slot, restore);
  phoneHolding.add(slot);
  try {
    player.clearAnimations(ANIM_SYNC_ALL);
    player.setSpecialAction(SPECIAL_ACTION_USECELLPHONE);
  } catch {
    // Анимация не обязательна для линии.
  }
}

function releasePhoneAnim(slot: number, userId: number): void {
  const restore = previousAction.get(slot) ?? SPECIAL_ACTION_NONE;
  previousAction.delete(slot);
  if (!phoneHolding.delete(slot)) {
    return;
  }

  const player = livePlayer(slot, userId);
  if (!player) {
    return;
  }

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
    player.setSpecialAction(restore);
  } catch {
    // Уже вышел.
  }
}

function playRing(player: Player): void {
  try {
    const pos = player.getPos();
    player.playGameSound(RING_SOUND, pos.x, pos.y, pos.z);
  } catch {
    try {
      player.playGameSound(RING_SOUND, 0, 0, 0);
    } catch {
      // Звонок не обязателен для входящего.
    }
  }
}
