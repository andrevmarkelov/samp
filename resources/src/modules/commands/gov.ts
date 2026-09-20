import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { MAX_ORG_RANK, getMembership } from "../org";
import { registerCommand } from "./registry";

registerCommand("gov", "Гос. новости", (player, args) => {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership || !membership.org.gov) {
    player.sendClientMessage(
      Color.error,
      "Вы не состоите в государственной организации."
    );
    return;
  }

  if (membership.rank.id !== MAX_ORG_RANK) {
    player.sendClientMessage(
      Color.error,
      "Гос. новости доступны только лидеру организации."
    );
    return;
  }

  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Использование: /gov [текст]");
    return;
  }

  const line = clipClientMessage(`Гос. новости ${playerChatName(player)}: ${text}`);

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      other.sendClientMessage(Color.govNews, line);
    } catch {
      // Слот пустой.
    }
  });
});
