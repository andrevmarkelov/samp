import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getGender } from "../auth/session";
import { registerCommand } from "./registry";

registerCommand("todo", "Replika i deystvie cherez *", (player, args) => {
  const split = args.indexOf("*");
  const speech = (split === -1 ? args : args.slice(0, split)).trim().slice(0, CHAT_MAX_LENGTH);
  const action = (split === -1 ? "" : args.slice(split + 1).trim()).slice(0, CHAT_MAX_LENGTH);

  if (!speech || !action) {
    player.sendClientMessage(
      Color.error,
      "Ispol'zovanie: /todo [replika]*[deystvie]"
    );
    player.sendClientMessage(Color.gray, "Primer: /todo Privet*mahaya rukoy");
    return;
  }

  const said = byGender(getGender(player), "сказал", "сказала");

  sendNearby(
    player,
    CHAT_RADIUS,
    Color.chat,
    `«${speech}», — ${said} ${playerName(player)}, ${action}.`
  );
});
