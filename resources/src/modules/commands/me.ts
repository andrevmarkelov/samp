import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sanitizeChatText, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { registerCommand } from "./registry";

registerCommand("me", "Действие или эмоция от третьего лица", (player, args) => {
  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Использование: /me [действие]");
    return;
  }

  sendNearby(player, CHAT_RADIUS, Color.action, `* ${playerName(player)} ${text}`);
});
