import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  CHAT_RADIUS,
  clipClientMessage,
  sanitizeChatText,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { getMembership } from "../org";
import { registerCommand } from "./registry";

const BUBBLE_MS = 3000;
const BUBBLE_TEXT = "Сообщение по рации.";

/** Тот же канал, что и /r: строка организации и подпись над игроком. */
export function broadcastOrgRadio(player: Player, text: string): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership || membership.org.illegal || membership.org.mafia) {
    return false;
  }

  return broadcastOrgRadioFrom(
    membership.org.id,
    membership.rank.title,
    playerChatName(player),
    text,
    player
  );
}

/**
 * Рация по уже известным званию и нику.
 * Нужна, когда аккаунт уже снят, например на выходе из игры.
 */
export function broadcastOrgRadioFrom(
  orgId: number,
  rankTitle: string,
  speakerName: string,
  text: string,
  bubblePlayer: Player | null
): boolean {
  const body = sanitizeChatText(text).slice(0, CHAT_MAX_LENGTH);
  if (!body || !rankTitle || !speakerName) {
    return false;
  }

  const line = clipClientMessage(`[R] ${rankTitle} ${speakerName}: ${body}`);

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const otherAccount = getAccount(other);
    const otherOrg = otherAccount ? getMembership(otherAccount) : null;
    if (!otherOrg || otherOrg.org.id !== orgId) {
      return;
    }

    try {
      other.sendClientMessage(Color.radio, line);
    } catch {
      // Слот пустой.
    }
  });

  if (!bubblePlayer) {
    return true;
  }

  try {
    bubblePlayer.setChatBubble(BUBBLE_TEXT, Color.radio, CHAT_RADIUS, BUBBLE_MS);
  } catch {
    // Пузырь не обязателен.
  }

  return true;
}

registerCommand("r", "Рация организации", (player, args) => {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership) {
    player.sendClientMessage(Color.error, "Вы не состоите в организации.");
    return;
  }

  if (membership.org.illegal || membership.org.mafia) {
    return;
  }

  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Использование: /r [текст]");
    return;
  }

  broadcastOrgRadio(player, text);
});
