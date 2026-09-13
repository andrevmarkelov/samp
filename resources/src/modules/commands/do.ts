import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sanitizeChatText, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { registerCommand } from "./registry";

registerCommand("do", "Obstanovka ili sobytie ryadom", (player, args) => {
  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Ispol'zovanie: /do [opisanie]");
    return;
  }

  sendNearby(
    player,
    CHAT_RADIUS,
    Color.scene,
    `* ${text} (( ${playerName(player)} ))`
  );
});
