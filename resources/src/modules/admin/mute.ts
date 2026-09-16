import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { saveUserMutedUntil } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { watchMute } from "../chat/mute";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 2;
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

export function bindAdminMute(): void {
  registerCommand(
    "mute",
    "Zaglushit' igroka",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /mute [id] [minuty] [prichina (ne obyazatel'no)]"
        );
        return;
      }

      const target = findTarget(parsed.slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      const account = getAccount(target);
      if (!account) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      if (account.adminLevel >= 1) {
        player.sendClientMessage(Color.error, "Nel'zya postavit' mut administratoru.");
        return;
      }

      void applyMute(player, target, parsed.minutes, parsed.reason);
    },
    true
  );
}

async function applyMute(
  admin: Player,
  target: Player,
  minutes: number,
  reason: string
): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  const previous = account.mutedUntil;
  const untilSec = Math.floor(Date.now() / 1000) + minutes * 60;
  const until = untilSec * 1000;
  patchAccount(target, { mutedUntil: until });
  watchMute(target);

  try {
    await saveUserMutedUntil(account.id, untilSec);
  } catch {
    if (isPlayerActive(target) && getAccount(target)?.id === account.id) {
      patchAccount(target, { mutedUntil: previous });
      watchMute(target);
    }
    admin.sendClientMessage(Color.error, "Ne udalos' sohranit' mut.");
    return;
  }

  const adminTag = playerChatName(admin);
  const targetTag = playerChatName(target);
  const line = reason
    ? `Administrator ${adminTag} zaglushil igroka ${targetTag}. Prichina: ${reason}.`
    : `Administrator ${adminTag} zaglushil igroka ${targetTag}.`;
  broadcastAll(Color.error, line);
}
