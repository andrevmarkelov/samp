import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sanitizeChatText, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getGender } from "../auth/session";
import { registerCommand } from "./registry";

registerCommand("try", "Случайное действие: удачно или неудачно", (player, args) => {
  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    player.sendClientMessage(Color.error, "Использование: /try [действие]");
    return;
  }

  const ok = Math.random() < 0.5;
  const tried = byGender(getGender(player), "попытался", "попыталась");
  const result = ok ? "Удачно" : "Неудачно";
  const color = ok ? Color.tryOk : Color.tryFail;

  sendNearby(
    player,
    CHAT_RADIUS,
    color,
    `* ${playerName(player)} ${tried} ${text} | ${result}`
  );
});
