import type { Player } from "@omp-node/core";
import {
  formatAfkElapsed,
  getAfkElapsedMs,
  isPlayerAfk,
} from "../afk";
import { getAccount } from "../auth/session";
import { isJailed } from "../prison/sentence";

/** Суффикс ` | AFK` или ` | AFK 12м 05с`. */
export function afkStatusSuffix(player: Player, withTime = false): string {
  if (!isPlayerAfk(player)) {
    return "";
  }

  if (!withTime) {
    return " | AFK";
  }

  const ms = getAfkElapsedMs(player);
  if (ms === null) {
    return " | AFK";
  }

  return ` | AFK ${formatAfkElapsed(ms)}`;
}

/** Суффикс ` | AFK | Jail | Mute` — только активные флаги. */
export function memberStatusSuffix(player: Player): string {
  const parts: string[] = [];
  if (isPlayerAfk(player)) {
    parts.push("AFK");
  }
  if (isJailed(player)) {
    parts.push("Jail");
  }
  if (isMutedNow(player)) {
    parts.push("Mute");
  }

  return parts.length > 0 ? ` | ${parts.join(" | ")}` : "";
}

/** Без side-effect expireMute — списки не должны снимать мут. */
function isMutedNow(player: Player): boolean {
  const until = getAccount(player)?.mutedUntil;
  if (until == null) {
    return false;
  }

  return until > Date.now();
}
