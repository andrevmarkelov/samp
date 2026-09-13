import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS } from "../../shared/nearby";
import { playerId } from "../../shared/player";
import { isMinerLocked } from "../miner";

const PLAYER_STATE_ONFOOT = 1;
const ANIM_SYNC_ALL = 1;

type TalkAnim = {
  min: number;
  lib: string;
  name: string;
};

const TALK_ANIMS: TalkAnim[] = [
  { min: 0, lib: "GANGS", name: "prtial_gngtlkA" },
  { min: 24, lib: "GANGS", name: "prtial_gngtlkB" },
  { min: 48, lib: "GANGS", name: "prtial_gngtlkC" },
  { min: 80, lib: "GANGS", name: "prtial_gngtlkG" },
];

function talkAnim(text: string): TalkAnim {
  let picked = TALK_ANIMS[0];
  for (const anim of TALK_ANIMS) {
    if (text.length >= anim.min) {
      picked = anim;
    }
  }
  return picked;
}

const talkTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function talkDurationMs(text: string): number {
  return Math.min(7000, Math.max(1500, 1000 + text.length * 70));
}

function canPlayTalkAnim(player: Player): boolean {
  try {
    if (player.isInAnyVehicle() || isMinerLocked(player)) {
      return false;
    }

    return player.getState() === PLAYER_STATE_ONFOOT;
  } catch {
    return false;
  }
}

function stopTalkAnim(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    const timer = talkTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      talkTimers.delete(id);
    }
  }

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Уже вышел или анимации нет.
  }
}

export function clearTalk(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    const timer = talkTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      talkTimers.delete(id);
    }
  }
}

export type SpeechOptions = {
  radius?: number;
  color?: number;
};

export function playLocalSpeech(
  player: Player,
  text: string,
  options: SpeechOptions = {}
): void {
  const duration = talkDurationMs(text);
  const radius = options.radius ?? CHAT_RADIUS;
  const color = options.color ?? Color.chat;

  try {
    player.setChatBubble(text, color, radius, duration);
  } catch {
    // Пузырь не обязателен, чат всё равно уйдёт.
  }

  if (!canPlayTalkAnim(player)) {
    return;
  }

  stopTalkAnim(player);

  const anim = talkAnim(text);
  try {
    player.applyAnimation(
      anim.lib,
      anim.name,
      4.1,
      true,
      true,
      true,
      false,
      0,
      ANIM_SYNC_ALL
    );
  } catch {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  talkTimers.set(
    id,
    setTimeout(() => {
      talkTimers.delete(id);
      if (playerId(player) !== id) {
        return;
      }

      try {
        player.clearAnimations(ANIM_SYNC_ALL);
      } catch {
        // Уже вышел.
      }
    }, duration)
  );
}
