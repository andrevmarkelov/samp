import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated, normalizeWantedLevel } from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { getMembership, isLawOfficer, notifyLawStaff } from "../org";
import { isJailed } from "../prison/sentence";
import { registerCommand } from "./registry";

const USAGE = "Использование: /su [id] [1-6] [причина]";
const DENY = "Команда доступна сотрудникам полиции и FBI.";
const MAX_WANTED = 6;

registerCommand(
  "su",
  "Выдать розыск игроку (полиция / FBI)",
  (player, args) => {
    if (!isAuthenticated(player) || !isLawOfficer(player)) {
      player.sendClientMessage(Color.error, DENY);
      return;
    }

    const officerAccount = getAccount(player);
    const officerMembership = officerAccount
      ? getMembership(officerAccount)
      : null;
    if (!officerAccount || !officerMembership) {
      player.sendClientMessage(Color.error, DENY);
      return;
    }

    const parsed = parseSuArgs(args);
    if (!parsed) {
      player.sendClientMessage(Color.error, USAGE);
      return;
    }

    const target = resolveTarget(parsed.slot);
    if (!target) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (playerId(target) === playerId(player)) {
      player.sendClientMessage(Color.error, "Нельзя объявить розыск на себя.");
      return;
    }

    if (isLawOfficer(target)) {
      player.sendClientMessage(
        Color.error,
        "Нельзя объявить розыск на сотрудника полиции или FBI."
      );
      return;
    }

    if (isJailed(target)) {
      player.sendClientMessage(
        Color.error,
        "Нельзя объявить розыск на игрока в тюрьме."
      );
      return;
    }

    const targetAccount = getAccount(target);
    if (!targetAccount) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (targetAccount.wantedLevel >= MAX_WANTED) {
      player.sendClientMessage(
        Color.error,
        "У игрока уже максимальный уровень розыска."
      );
      return;
    }

    const prev = targetAccount.wantedLevel;
    const next = normalizeWantedLevel(prev + parsed.level);
    const added = next - prev;
    setPlayerWantedLevel(target, next);

    const rankTitle = officerMembership.rank.title;
    notifyLawStaff(
      `Диспетчер: ${rankTitle} ${playerChatName(player)} объявил розыск на ${playerChatName(target)} (+${added}, итого ${next}). Причина: ${parsed.reason}`
    );

    try {
      target.sendClientMessage(
        Color.error,
        `Вам объявили розыск (+${added}, итого ${next}). Причина: ${parsed.reason}`
      );
    } catch {
      // Уже вышел.
    }

    player.sendClientMessage(
      Color.info,
      `Розыск выдан: ${playerChatName(target)} (+${added}, итого ${next}).`
    );
  }
);

function parseSuArgs(
  args: string
): { slot: number; level: number; reason: string } | null {
  const raw = args.trim();
  const match = raw.match(/^(\d+)\s+([1-6])\s+(.+)$/);
  if (!match) {
    return null;
  }

  const slot = Number(match[1]);
  const level = Number(match[2]);
  const reason = sanitizeChatText(match[3].trim()).slice(0, CHAT_MAX_LENGTH);
  if (!Number.isInteger(slot) || slot < 0 || !reason) {
    return null;
  }

  return { slot, level, reason };
}

function resolveTarget(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    return null;
  }

  try {
    if (target.isNPC()) {
      return null;
    }
  } catch {
    return null;
  }

  return target;
}
