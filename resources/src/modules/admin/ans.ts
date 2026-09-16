import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount, getGender } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const ANSWER_SOUND_ID = 1085;

function findTarget(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !getAccount(target)) {
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

function sendAnswer(line: string, target: Player): void {
  const seen = new Set<number>();

  const send = (player: Player): void => {
    const id = playerId(player);
    if (id === null || seen.has(id) || !isPlayerActive(player)) {
      return;
    }

    seen.add(id);
    try {
      player.sendClientMessage(Color.adminChat, line);
    } catch {
      // Слот пустой.
    }
  };

  send(target);
  playAnswerSound(target);
  omp.players.forEach((other) => {
    if (!hasAdminAccess(other, 1)) {
      return;
    }

    send(other);
  });
}

function playAnswerSound(player: Player): void {
  try {
    const pos = player.getPos();
    player.playGameSound(ANSWER_SOUND_ID, pos.x, pos.y, pos.z);
  } catch {
    try {
      player.playGameSound(ANSWER_SOUND_ID, 0, 0, 0);
    } catch {
      // Слот пустой.
    }
  }
}

export function bindAdminAns(): void {
  registerCommand(
    "ans",
    "Otvetit' igroku",
    (player, args) => {
      if (!hasAdminAccess(player, 1)) {
        return;
      }

      const raw = args.trim();
      const space = raw.indexOf(" ");
      const idPart = (space === -1 ? raw : raw.slice(0, space)).trim();
      const text = sanitizeChatText(space === -1 ? "" : raw.slice(space + 1).trim()).slice(
        0,
        CHAT_MAX_LENGTH
      );

      if (!idPart || !text) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /ans [id] [tekst]");
        return;
      }

      const slot = Number(idPart);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /ans [id] [tekst]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      const verb = byGender(getGender(player), "otvetil", "otvetila");
      const line = clipClientMessage(
        `[A] Administrator ${playerChatName(player)} ${verb} igroku ${playerChatName(target)}: ${text}`
      );
      sendAnswer(line, target);
    },
    true
  );
}
