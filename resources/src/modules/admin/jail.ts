import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { applyJail, applyUnjail, isJailed } from "../prison/sentence";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 3;
const MIN_MINUTES = 1;
const MAX_MINUTES = 10_080;

function parseArgs(
  args: string
): { slot: number; minutes: number; reason: string } | null {
  const raw = args.trim();
  const parts = raw.split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(minutes)) {
    return null;
  }

  if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return null;
  }

  const reason = sanitizeChatText(parts.slice(2).join(" ").trim()).slice(0, CHAT_MAX_LENGTH);
  return { slot, minutes, reason };
}

function findTarget(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
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

function broadcastAll(color: number, text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      other.sendClientMessage(color, text);
    } catch {
      // Слот пустой.
    }
  });
}

export function bindAdminJail(): void {
  registerCommand(
    "jail",
    "Посадить игрока в тюрьму",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Использование: /jail [id] [минуты] [причина (не обязательно)]"
        );
        return;
      }

      const target = findTarget(parsed.slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      const account = getAccount(target);
      if (!account) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (isJailed(target)) {
        player.sendClientMessage(Color.error, "Игрок уже в тюрьме.");
        return;
      }

      if (account.adminLevel >= 1) {
        player.sendClientMessage(Color.error, "Нельзя посадить администратора.");
        return;
      }

      void applyAndAnnounce(player, target, parsed.minutes, parsed.reason);
    },
    true
  );

  registerCommand(
    "unjail",
    "Выпустить игрока из тюрьмы",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const raw = args.trim();
      const slot = Number(raw);
      if (!raw || !Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Использование: /unjail [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      const account = getAccount(target);
      if (!account) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (!isJailed(target)) {
        player.sendClientMessage(Color.error, "Игрок не в тюрьме.");
        return;
      }

      void applyUnjailAndAnnounce(player, target);
    },
    true
  );
}

async function applyAndAnnounce(
  admin: Player,
  target: Player,
  minutes: number,
  reason: string
): Promise<void> {
  const ok = await applyJail(target, minutes);
  if (!ok) {
    admin.sendClientMessage(Color.error, "Не удалось посадить игрока.");
    return;
  }

  const adminTag = playerChatName(admin);
  const targetTag = playerChatName(target);
  const line = reason
    ? `Администратор ${adminTag} посадил игрока ${targetTag} в тюрьму на ${minutes} мин. Причина: ${reason}.`
    : `Администратор ${adminTag} посадил игрока ${targetTag} в тюрьму на ${minutes} мин.`;
  broadcastAll(Color.error, line);
}

async function applyUnjailAndAnnounce(admin: Player, target: Player): Promise<void> {
  const ok = await applyUnjail(target);
  if (!ok) {
    admin.sendClientMessage(Color.error, "Не удалось выпустить игрока.");
    return;
  }

  const adminTag = playerChatName(admin);
  const targetTag = playerChatName(target);
  broadcastAll(
    Color.error,
    `Администратор ${adminTag} выпустил игрока ${targetTag} из тюрьмы.`
  );
}
