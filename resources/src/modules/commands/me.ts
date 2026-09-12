import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { registerCommand } from "./registry";

registerCommand("me", "Deystvie ili emotsiya ot tret'ego litsa", (player, args) => {
  const text = args.trim().slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Ispol'zovanie: /me [deystvie]");
    return;
  }

  sendNearby(player, CHAT_RADIUS, Color.action, `* ${playerName(player)} ${text}`);
});
