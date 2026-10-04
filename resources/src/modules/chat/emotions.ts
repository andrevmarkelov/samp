import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { byGender, type Gender } from "../auth/gender";
import { isCuffed } from "../cuff";
import { isLoaderCarrying } from "../loader";
import { isMinerLocked } from "../miner";

const PLAYER_STATE_ONFOOT = 1;
const ANIM_SYNC_ALL = 1;
const BUBBLE_MS = 4000;

type EmotionAnim = {
  lib: string;
  name: string;
};

type Emotion = {
  trigger: string;
  status: (gender: Gender | null) => string;
  anim?: EmotionAnim;
};

/** Более длинные триггеры раньше коротких (`))` до `)`). */
const EMOTIONS: Emotion[] = [
  {
    trigger: "))",
    status: () => "смеётся",
  },
  {
    trigger: "((",
    status: (gender) =>
      byGender(gender, "сильно расстроился", "сильно расстроилась"),
    anim: { lib: "GRAVEYARD", name: "mrnF_loop" },
  },
  {
    trigger: ")",
    status: () => "улыбается",
  },
  {
    trigger: "(",
    status: (gender) => byGender(gender, "расстроился", "расстроилась"),
  },
  {
    trigger: "=0",
    status: (gender) => byGender(gender, "удивился", "удивилась"),
  },
];

function canPlayEmotionAnim(player: Player): boolean {
  try {
    // Наручники: applyAnimation сбросит freeze-позу cpr_loop.
    if (
      isCuffed(player) ||
      player.isInAnyVehicle() ||
      isMinerLocked(player) ||
      isLoaderCarrying(player)
    ) {
      return false;
    }

    return player.getState() === PLAYER_STATE_ONFOOT;
  } catch {
    return false;
  }
}

/**
 * Точные IC-эмоции в чате: `)`, `))`, `(`, `((`, `=0`.
 * Рядом — как `/me` (`Color.action`) + пузырь над головой.
 */
export function tryChatEmotion(
  player: Player,
  text: string,
  gender: Gender | null
): boolean {
  const key = text.toLowerCase();
  const emotion = EMOTIONS.find((entry) => entry.trigger === key);
  if (!emotion) {
    return false;
  }

  const status = emotion.status(gender);
  sendNearby(player, CHAT_RADIUS, Color.action, `${playerName(player)} ${status}`);

  try {
    player.setChatBubble(status, Color.action, CHAT_RADIUS, BUBBLE_MS);
  } catch {
    // Пузырь не обязателен.
  }

  if (emotion.anim && canPlayEmotionAnim(player)) {
    try {
      player.applyAnimation(
        emotion.anim.lib,
        emotion.anim.name,
        4.1,
        false,
        false,
        false,
        false,
        0,
        ANIM_SYNC_ALL
      );
    } catch {
      // Анимация опциональна.
    }
  }

  return true;
}
