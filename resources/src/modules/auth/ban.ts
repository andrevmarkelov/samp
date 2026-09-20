import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { kickSamePlayer } from "../../shared/player";
import { DialogStyle } from "./dialogs";

export const BAN_NOTICE_DIALOG_ID = 40;
export const MAX_BAN_DAYS = 3650;
const BAN_KICK_DELAY_MS = 2500;
const DAY_MS = 86_400_000;
const UNIX_MIN = 1_000_000_000;

export type BanUntil = {
  untilUnix: number | null;
  persist: boolean;
};

export function resolveBanUntil(value: unknown, nowMs = Date.now()): BanUntil {
  if (value == null || value === "") {
    return { untilUnix: null, persist: false };
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    if (!Number.isFinite(ms) || ms <= 0) {
      return { untilUnix: null, persist: false };
    }

    return { untilUnix: Math.floor(ms / 1000), persist: false };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("0000-00-00")) {
      return { untilUnix: null, persist: false };
    }

    const asNumber = Number(trimmed);
    if (
      Number.isFinite(asNumber) &&
      asNumber > 0 &&
      !trimmed.includes("-") &&
      !trimmed.includes(":")
    ) {
      return fromNumericBan(asNumber, nowMs);
    }

    const parsed = Date.parse(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"));
    if (Number.isFinite(parsed) && parsed > 0) {
      return { untilUnix: Math.floor(parsed / 1000), persist: false };
    }

    return { untilUnix: null, persist: false };
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { untilUnix: null, persist: false };
  }

  return fromNumericBan(numeric, nowMs);
}

function fromNumericBan(raw: number, nowMs: number): BanUntil {
  const value = Math.floor(raw);
  if (value <= 0) {
    return { untilUnix: null, persist: false };
  }

  if (value <= MAX_BAN_DAYS) {
    return { untilUnix: Math.floor(nowMs / 1000) + value * 86_400, persist: true };
  }

  if (value >= 1_000_000_000_000) {
    return { untilUnix: Math.floor(value / 1000), persist: false };
  }

  if (value >= UNIX_MIN) {
    return { untilUnix: value, persist: false };
  }

  return { untilUnix: null, persist: false };
}

export function parseBannedUntil(value: unknown): number | null {
  return resolveBanUntil(value).untilUnix;
}

export function isBanActive(untilUnix: number | null, nowMs = Date.now()): untilUnix is number {
  return untilUnix != null && untilUnix > 0 && untilUnix * 1000 > nowMs;
}

export function remainingBanDays(untilUnix: number, nowMs = Date.now()): number {
  return Math.max(1, Math.ceil((untilUnix * 1000 - nowMs) / DAY_MS));
}

export function banDaysWord(days: number): string {
  const n = Math.abs(Math.floor(days)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) {
    return "dney";
  }
  if (n1 === 1) {
    return "den'";
  }
  if (n1 >= 2 && n1 <= 4) {
    return "dnya";
  }
  return "dney";
}

export function kickBannedPlayer(player: Player, untilUnix: number, reason: string): void {
  const days = remainingBanDays(untilUnix);
  const word = banDaysWord(days);
  const reasonText = reason.trim() || "ne ukazana";
  const chat = `Vy zabaneny na ${days} ${word}. Prichina: ${reasonText}.`;

  try {
    player.sendClientMessage(Color.error, chat);
  } catch {
    // Слот пустой.
  }

  try {
    Dialog.show(
      player,
      BAN_NOTICE_DIALOG_ID,
      DialogStyle.msgbox,
      "Ban",
      `Vy zabaneny na etom servere.\nSrok: ${days} ${word}.\nPrichina: ${reasonText}`,
      "OK",
      ""
    );
  } catch {
    // Слот пустой.
  }

  kickSamePlayer(player, BAN_KICK_DELAY_MS);
}
