import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, SHOUT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { playLocalSpeech } from "../chat/talk";
import { registerCommand } from "./registry";

registerCommand("s", "Крикнуть на большую дистанцию", (player, args) => {
  const text = args.trim().slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Использование: /s [текст]");
    return;
  }

  sendNearby(
    player,
    SHOUT_RADIUS,
    Color.shout,
    `${playerName(player)} кричит: ${text}`
  );
  playLocalSpeech(player, text, { radius: SHOUT_RADIUS, color: Color.shout });
});
