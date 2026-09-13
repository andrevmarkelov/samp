import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, WHISPER_RADIUS, sanitizeChatText, sendNearby } from "../../shared/nearby";
import { playerChatName } from "../../shared/player";
import { playLocalSpeech } from "../chat/talk";
import { registerCommand } from "./registry";

registerCommand("w", "Shepnut' tem, kto stoit ryadom", (player, args) => {
  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Ispol'zovanie: /w [tekst]");
    return;
  }

  sendNearby(
    player,
    WHISPER_RADIUS,
    Color.whisper,
    `${playerChatName(player)} шепчет: ${text}`
  );
  playLocalSpeech(player, text, { radius: WHISPER_RADIUS, color: Color.whisper });
});
