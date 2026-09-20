import { omp } from "@omp-node/core";
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
const BUBBLE_TEXT = "Soobschenie po racii.";

registerCommand("r", "Raciya organizacii", (player, args) => {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership) {
    player.sendClientMessage(Color.error, "Vy ne sostoite v organizacii.");
    return;
  }

  if (membership.org.illegal || membership.org.mafia) {
    return;
  }

  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Ispol'zovanie: /r [tekst]");
    return;
  }

  const line = clipClientMessage(
    `[R] ${membership.rank.title} ${playerChatName(player)}: ${text}`
  );
  const orgId = membership.org.id;

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

  try {
    player.setChatBubble(BUBBLE_TEXT, Color.radio, CHAT_RADIUS, BUBBLE_MS);
  } catch {
    // Пузырь не обязателен.
  }
});
