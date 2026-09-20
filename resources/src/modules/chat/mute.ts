import { Color } from "../../shared/colors";
import { CHAT_RADIUS } from "../../shared/nearby";
import type { Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserMutedUntil } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";

export const MUTED_CHAT_COMMANDS = new Set([
  "me",
  "do",
  "try",
  "todo",
  "b",
  "s",
  "w",
  "r",
  "d",
  "gov",
  "f",
  "ad",
]);

const BUBBLE_MS = 3500;
const BUBBLE_TEXT = "Пытается что-то сказать...";
const MUTE_RED = 0xff0000ff;

type MuteTimer = {
  until: number;
  timer: ReturnType<typeof setTimeout>;
};

const muteTimers = new Map<number, MuteTimer>();

export function remainingMuteMs(player: Player): number | null {
  const account = getAccount(player);
  if (!account?.mutedUntil) {
    return null;
  }

  const left = account.mutedUntil - Date.now();
  if (left <= 0) {
    expireMute(player, true);
    return null;
  }

  return left;
}

export function notifyIfMuted(player: Player, options?: { bubble?: boolean }): boolean {
  const left = remainingMuteMs(player);
  if (left === null) {
    return false;
  }

  player.sendClientMessage(
    Color.error,
    `У вас запрет на чат. Осталось: ${formatMuteLeft(left)}.`
  );

  if (options?.bubble) {
    try {
      player.setChatBubble(BUBBLE_TEXT, MUTE_RED, CHAT_RADIUS, BUBBLE_MS);
    } catch {
      // Пузырь не обязателен.
    }
  }

  return true;
}

export function watchMute(player: Player): void {
  clearMuteWatch(player);

  const account = getAccount(player);
  if (!account?.mutedUntil) {
    return;
  }

  const left = account.mutedUntil - Date.now();
  if (left <= 0) {
    expireMute(player, true);
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const until = account.mutedUntil;
  muteTimers.set(id, {
    until,
    timer: setTimeout(() => {
      muteTimers.delete(id);
      if (playerId(player) !== id) {
        return;
      }

      const live = getAccount(player);
      if (!live || live.mutedUntil !== until) {
        return;
      }

      expireMute(player, true);
    }, left),
  });
}

export function clearMuteWatch(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const current = muteTimers.get(id);
  if (!current) {
    return;
  }

  clearTimeout(current.timer);
  muteTimers.delete(id);
}

function expireMute(player: Player, notify: boolean): void {
  const account = getAccount(player);
  if (!account?.mutedUntil) {
    return;
  }

  clearMuteWatch(player);
  patchAccount(player, { mutedUntil: null });
  void saveUserMutedUntil(account.id, null).catch(() => {
    // Срок вышел — следующая проверка снова попробует очистить.
  });

  if (notify && isPlayerActive(player)) {
    player.sendClientMessage(Color.info, "Вы снова можете пользоваться чатом.");
  }
}

export function formatMuteLeft(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ч.`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} мин.`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} сек.`);
  }
  return parts.join(" ");
}
