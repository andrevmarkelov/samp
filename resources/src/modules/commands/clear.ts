import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { isLawOfficer, lawOfficerLabel, notifyLawStaff } from "../org/law";
import { registerCommand } from "./registry";

registerCommand("clear", "Снять розыск с игрока (полиция / FBI)", (player, args) => {
  if (!isAuthenticated(player) || !isLawOfficer(player)) {
    player.sendClientMessage(
      Color.error,
      "Команда доступна сотрудникам полиции и FBI."
    );
    return;
  }

  const raw = args.trim();
  if (!raw) {
    player.sendClientMessage(Color.error, "Использование: /clear [id]");
    return;
  }

  if (!/^\d+$/.test(raw)) {
    player.sendClientMessage(Color.error, "Использование: /clear [id]");
    return;
  }

  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /clear [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  try {
    if (target.isNPC()) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }
  } catch {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    player.sendClientMessage(Color.error, "Нельзя снять розыск с себя.");
    return;
  }

  const targetAccount = getAccount(target);
  if (!targetAccount) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (targetAccount.wantedLevel <= 0) {
    player.sendClientMessage(Color.error, "Этот игрок не в розыске.");
    return;
  }

  setPlayerWantedLevel(target, 0);

  notifyLawStaff(
    `${lawOfficerLabel(player)} ${playerChatName(player)} снял розыск у игрока ${playerChatName(target)}.`
  );

  try {
    target.sendClientMessage(Color.info, "С вас сняли розыск.");
  } catch {
    // Уже вышел.
  }
});
