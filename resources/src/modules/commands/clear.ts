import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { isLawOfficer, lawOfficerLabel, notifyLawStaff } from "../org/law";
import { registerCommand } from "./registry";

/**
 * Снять розыск с цели (логика /clear).
 * @returns текст ошибки или `null` при успехе.
 */
export function clearWantedByOfficer(officer: Player, target: Player): string | null {
  if (!isAuthenticated(officer) || !isLawOfficer(officer)) {
    return "Команда доступна сотрудникам полиции и FBI.";
  }

  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    return "Игрок не найден.";
  }

  try {
    if (target.isNPC()) {
      return "Игрок не найден.";
    }
  } catch {
    return "Игрок не найден.";
  }

  if (playerId(target) === playerId(officer)) {
    return "Нельзя снять розыск с себя.";
  }

  const targetAccount = getAccount(target);
  if (!targetAccount) {
    return "Игрок не найден.";
  }

  if (targetAccount.wantedLevel <= 0) {
    return "Этот игрок не в розыске.";
  }

  setPlayerWantedLevel(target, 0);

  notifyLawStaff(
    `${lawOfficerLabel(officer)} ${playerChatName(officer)} снял розыск у игрока ${playerChatName(target)}.`
  );

  try {
    target.sendClientMessage(Color.info, "С вас сняли розыск.");
  } catch {
    // Уже вышел.
  }

  return null;
}

registerCommand("clear", "Снять розыск с игрока (полиция / FBI)", (player, args) => {
  if (!isAuthenticated(player) || !isLawOfficer(player)) {
    player.sendClientMessage(
      Color.error,
      "Команда доступна сотрудникам полиции и FBI."
    );
    return;
  }

  const raw = args.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    player.sendClientMessage(Color.error, "Использование: /clear [id]");
    return;
  }

  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /clear [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  const error = clearWantedByOfficer(player, target);
  if (error) {
    player.sendClientMessage(Color.error, error);
  }
});
