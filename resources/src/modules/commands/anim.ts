import { Color } from "../../shared/colors";
import { isAuthenticated } from "../auth/session";
import { ANIM_COUNT, openAnimDialog, playAnimByIndex } from "../anim";
import { registerCommand } from "./registry";

registerCommand("anim", "Список анимаций или /anim [1-74]", (player, args) => {
  if (!isAuthenticated(player)) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const raw = args.trim();
  if (!raw) {
    openAnimDialog(player);
    return;
  }

  if (!/^\d+$/.test(raw)) {
    player.sendClientMessage(Color.error, "Использование: /anim [1-74]");
    return;
  }

  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1 || number > ANIM_COUNT) {
    player.sendClientMessage(
      Color.error,
      `Использование: /anim [1-${ANIM_COUNT}]`
    );
    return;
  }

  playAnimByIndex(player, number - 1);
});
