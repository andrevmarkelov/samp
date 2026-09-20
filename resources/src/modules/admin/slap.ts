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
    "Podkinut' igroka vverh",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const idPart = args.trim();
      if (!idPart) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /slap [id]");
        return;
      }

      const slot = Number(idPart);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /slap [id]");
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

      if (!slapPlayer(target)) {
        player.sendClientMessage(Color.error, "Ne udalos' podkinut' igroka.");
        return;
      }

      broadcastAdmins(
        `Administrator ${playerChatName(player)} podbrosil ${playerChatName(target)}.`
      );
    },
    true
  );
}
