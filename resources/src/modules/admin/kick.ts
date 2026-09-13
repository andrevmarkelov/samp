import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
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
  setTimeout(() => {
    if (!isPlayerActive(player)) {
      return;
    }

    try {
      player.kick();
    } catch {
      // Уже вышел.
    }
  }, 120);
}

export function bindAdminKick(): void {
  registerCommand(
    "kick",
    "Kiknut' igroka",
    (player, args) => {
      if (!canUseKick(player)) {
        return;
      }

      const raw = args.trim();
      const space = raw.indexOf(" ");
      const idPart = (space === -1 ? raw : raw.slice(0, space)).trim();
      const reason = (space === -1 ? "" : raw.slice(space + 1).trim())
        .replace(/\{/g, "")
        .slice(0, CHAT_MAX_LENGTH);

      if (!idPart) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /kick [id] [prichina (ne obyazatel'no)]"
        );
        return;
      }

      const slot = Number(idPart);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /kick [id] [prichina (ne obyazatel'no)]"
        );
        return;
      }

      const target = omp.players.at(slot);
      if (!target || !isPlayerActive(target)) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      try {
        if (target.isNPC()) {
          player.sendClientMessage(Color.error, "Igrok ne nayden.");
          return;
        }
      } catch {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      const adminTag = playerChatName(player);
      const targetTag = playerChatName(target);
      const line = reason
        ? `Administrator ${adminTag} kiknul igroka ${targetTag}. Prichina: ${reason}.`
        : `Administrator ${adminTag} kiknul igroka ${targetTag}.`;
      broadcastAll(Color.error, line);
      kickSoon(target);
    },
    true
  );
}
