import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 1;
const SLAP_HEIGHT = 5;
const SLAP_VELOCITY = 0.85;

function broadcastAdmins(text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !hasAdminAccess(other, 1)) {
      return;
    }

    try {
      other.sendClientMessage(Color.gray, text);
    } catch {
      // Слот пустой.
    }
  });
}

function slapPlayer(target: Player): boolean {
  try {
    if (target.isInAnyVehicle()) {
      target.removeFromVehicle();
    }
  } catch {
    // Уже не в транспорте.
  }

  try {
    const pos = target.getPos();
    target.setPos(pos.x, pos.y, pos.z + SLAP_HEIGHT);
  } catch {
    return false;
  }

  try {
    target.setVelocity(0, 0, SLAP_VELOCITY);
  } catch {
    // Позиция уже сдвинута вверх.
  }

  return true;
}

export function bindAdminSlap(): void {
  registerCommand(
    "slap",
    "Подкинуть игрока вверх",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const idPart = args.trim();
      if (!idPart) {
        player.sendClientMessage(Color.error, "Использование: /slap [id]");
        return;
      }

      const slot = Number(idPart);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Использование: /slap [id]");
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

      if (!slapPlayer(target)) {
        player.sendClientMessage(Color.error, "Не удалось подкинуть игрока.");
        return;
      }

      broadcastAdmins(
        `Администратор ${playerChatName(player)} подбросил ${playerChatName(target)}.`
      );
    },
    true
  );
}
