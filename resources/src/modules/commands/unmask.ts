import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS, WHISPER_RADIUS, arePlayersNearby, sendNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount, isAuthenticated } from "../auth/session";
import { clearMask, isMasked } from "../mask";
import { applyOrgVisuals } from "../org/appearance";
import { isLawOfficer } from "../org/law";
import { isJailed } from "../prison/sentence";
import { registerCommand } from "./registry";

const DENY = "Команда доступна сотрудникам полиции и FBI.";
const PLAYER_STATE_WASTED = 7;

registerCommand("unmask", "Сорвать маску с игрока (полиция / FBI)", (player, args) => {
  if (!isAuthenticated(player) || !isLawOfficer(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  if (isJailed(player)) {
    player.sendClientMessage(Color.error, "В тюрьме нельзя снимать маски.");
    return;
  }

  const raw = args.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    player.sendClientMessage(Color.error, "Использование: /unmask [id]");
    return;
  }

  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /unmask [id]");
    return;
  }

  const officerId = playerId(player);
  if (officerId === null) {
    return;
  }

  if (slot === officerId) {
    player.sendClientMessage(Color.error, "Нельзя сорвать маску с себя.");
    return;
  }

  const target = findPlayer(slot);
  if (!target) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  try {
    if (target.getState() === PLAYER_STATE_WASTED) {
      player.sendClientMessage(Color.error, "Игрок не в игре.");
      return;
    }
  } catch {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  if (!isMasked(target)) {
    player.sendClientMessage(Color.error, "На этом игроке нет маски.");
    return;
  }

  if (!clearMask(target)) {
    player.sendClientMessage(Color.error, "Не удалось снять маску.");
    return;
  }

  applyOrgVisuals(target);

  const officerName = playerName(player);
  const targetName = playerName(target);
  const verb = byGender(
    getAccount(player)?.gender ?? null,
    "сорвал",
    "сорвала"
  );
  sendNearby(
    player,
    CHAT_RADIUS,
    Color.action,
    `${officerName} резко ${verb} маску с лица ${targetName}.`
  );

  try {
    target.sendClientMessage(Color.error, "С вас сорвали маску.");
  } catch {
    // Уже вышел.
  }

  player.sendClientMessage(Color.info, `Вы сорвали маску с ${targetName}.`);
});

function findPlayer(slot: number): Player | null {
  try {
    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      return null;
    }

    if (target.isNPC()) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}
