import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, kickSamePlayer, playerChatName } from "../../shared/player";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

function canUseKick(player: Player): boolean {
  return hasAdminAccess(player, 2);
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

function kickSoon(player: Player): void {
  kickSamePlayer(player);
}

export function bindAdminKick(): void {
  registerCommand(
    "kick",
    "Кикнуть игрока",
    (player, args) => {
      if (!canUseKick(player)) {
        return;
      }

      const raw = args.trim();
      const space = raw.indexOf(" ");
      const idPart = (space === -1 ? raw : raw.slice(0, space)).trim();
      const reason = sanitizeChatText(space === -1 ? "" : raw.slice(space + 1).trim()).slice(
        0,
        CHAT_MAX_LENGTH
      );

      if (!idPart) {
        player.sendClientMessage(
          Color.error,
          "Использование: /kick [id] [причина (не обязательно)]"
        );
        return;
      }

      const slot = Number(idPart);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(
          Color.error,
          "Использование: /kick [id] [причина (не обязательно)]"
        );
        return;
      }

      const target = omp.players.at(slot);
      if (!target || !isPlayerActive(target)) {
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

      const adminTag = playerChatName(player);
      const targetTag = playerChatName(target);
      const line = reason
        ? `Администратор ${adminTag} кикнул игрока ${targetTag}. Причина: ${reason}.`
        : `Администратор ${adminTag} кикнул игрока ${targetTag}.`;
      broadcastAll(Color.error, line);
      kickSoon(target);
    },
    true
  );
}
