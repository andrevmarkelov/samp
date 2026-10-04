import { Color } from "../../shared/colors";
import { getAccount } from "../auth/session";
import {
  getOwnedMasks,
  isMasked,
  MASK_DURATION_MINUTES,
  removeMask,
  wearMask,
} from "../mask";
import { isJailed } from "../prison/sentence";
import { registerCommand } from "./registry";

registerCommand("mask", "Надеть или снять маску", (player) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  if (isMasked(player)) {
    removeMask(player);
    player.sendClientMessage(Color.gray, "Вы сняли маску.");
    return;
  }

  if (account.hospitalized) {
    player.sendClientMessage(
      Color.error,
      "Сначала пройдите лечение в больнице."
    );
    return;
  }

  if (isJailed(player)) {
    player.sendClientMessage(Color.error, "В тюрьме нельзя надевать маску.");
    return;
  }

  const have = getOwnedMasks(player);
  if (have < 1) {
    player.sendClientMessage(
      Color.error,
      "У вас нет маски. Купите в магазине 24/7."
    );
    return;
  }

  if (!wearMask(player)) {
    player.sendClientMessage(Color.error, "Не удалось надеть маску.");
    return;
  }

  player.sendClientMessage(
    Color.tryOk,
    `Вы надели маску на ${MASK_DURATION_MINUTES} мин. Осталось масок: ${have - 1}.`
  );
});
