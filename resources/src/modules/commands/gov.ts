import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { MAX_ORG_RANK, getMembership } from "../org";
import { registerCommand } from "./registry";

registerCommand("gov", "Gos. novosti", (player, args) => {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership || !membership.org.gov) {
    player.sendClientMessage(
      Color.error,
      "Vy ne sostoite v gosudarstvennoy organizacii."
    );
    return;
  }

  if (membership.rank.id !== MAX_ORG_RANK) {
    player.sendClientMessage(
      Color.error,
      "Gos. novosti dostupny tol'ko lideru organizacii."
    );
    return;
  }

  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Ispol'zovanie: /gov [tekst]");
    return;
  }

  const line = clipClientMessage(`Gos. novosti ${playerChatName(player)}: ${text}`);

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
