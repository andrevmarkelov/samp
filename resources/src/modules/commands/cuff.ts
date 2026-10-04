import { Color } from "../../shared/colors";
import { CHAT_RADIUS, WHISPER_RADIUS, arePlayersNearby, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount } from "../auth/session";
import { applyCuff, clearCuff, isCuffed } from "../cuff";
import { isJailed } from "../prison/sentence";
import { resolveLawNearbyTarget } from "./law-target";
import { registerCommand } from "./registry";

registerCommand("cuff", "Надеть наручники (полиция / FBI)", (player, args) => {
  const resolved = resolveLawNearbyTarget(
    player,
    args,
    "Использование: /cuff [id]"
  );
  if (!resolved.ok) {
    return;
  }

  const { officer, target } = resolved;

  if (isJailed(target)) {
    officer.sendClientMessage(Color.error, "Игрок уже в тюрьме.");
    return;
  }

  if (isCuffed(target)) {
    officer.sendClientMessage(Color.error, "На игроке уже надеты наручники.");
    return;
  }

  // Повторно: цель могла отойти между проверками.
  if (!arePlayersNearby(officer, target, WHISPER_RADIUS)) {
    officer.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  if (!applyCuff(target)) {
    officer.sendClientMessage(Color.error, "Не удалось надеть наручники.");
    return;
  }

  const officerName = playerName(officer);
  const targetName = playerName(target);
  const verb = byGender(
    getAccount(officer)?.gender ?? null,
    "надел",
    "надела"
  );

  sendNearby(
    officer,
    CHAT_RADIUS,
    Color.action,
    `${officerName} ${verb} наручники на ${targetName}.`
  );

  officer.sendClientMessage(Color.info, `Вы надели наручники на ${targetName}.`);
  try {
    target.sendClientMessage(Color.error, "На вас надели наручники.");
  } catch {
    // Уже вышел.
  }
});

registerCommand("uncuff", "Снять наручники (полиция / FBI)", (player, args) => {
  const resolved = resolveLawNearbyTarget(
    player,
    args,
    "Использование: /uncuff [id]"
  );
  if (!resolved.ok) {
    return;
  }

  const { officer, target } = resolved;

  if (!isCuffed(target)) {
    officer.sendClientMessage(Color.error, "На игроке нет наручников.");
    return;
  }

  if (!arePlayersNearby(officer, target, WHISPER_RADIUS)) {
    officer.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  if (!clearCuff(target)) {
    officer.sendClientMessage(Color.error, "Не удалось снять наручники.");
    return;
  }

  const officerName = playerName(officer);
  const targetName = playerName(target);
  const verb = byGender(
    getAccount(officer)?.gender ?? null,
    "снял",
    "сняла"
  );

  sendNearby(
    officer,
    CHAT_RADIUS,
    Color.action,
    `${officerName} ${verb} наручники с ${targetName}.`
  );

  officer.sendClientMessage(Color.info, `Вы сняли наручники с ${targetName}.`);
  try {
    target.sendClientMessage(Color.info, "С вас сняли наручники.");
  } catch {
    // Уже вышел.
  }
});
