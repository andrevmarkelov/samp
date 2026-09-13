import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

function sendAdminChat(text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !hasAdminAccess(other, 1)) {
      return;
    }

    try {
      other.sendClientMessage(Color.adminChat, text);
    } catch {
      // Слот пустой.
    }
  });
}

export function bindAdminChat(): void {
  registerCommand(
    "a",
    "Chat administracii",
    (player, args) => {
      if (!hasAdminAccess(player, 1)) {
        return;
      }

      const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
      if (!text) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /a [tekst]");
        return;
      }

      sendAdminChat(`[A] ${playerChatName(player)}: ${text}`);
    },
    true
  );
}
