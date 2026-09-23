import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import {
  isPlayerActive,
  kickSamePlayer,
  playerChatName,
  playerId,
  playerIp,
} from "../../shared/player";
import { getAccount } from "../auth/session";
import { AcCode } from "./codes";
import { getConfig, INSTANT_KICK_CODES, isCodeEnabled } from "./config";
import { codeName } from "./messages";
import { getPlayerState } from "./state";

type DetectHandler = (
  player: Player,
  code: AcCode,
  detail?: string
) => void | boolean;

let onDetect: DetectHandler | null = null;

export function setCheatHandler(handler: DetectHandler | null): void {
  onDetect = handler;
}

function notifyAdmins(message: string): void {
  try {
    omp.players.forEach((player) => {
      if (!isPlayerActive(player)) return;
      const account = getAccount(player);
      if (!account || account.adminLevel < 1) return;
      try {
        player.sendClientMessage(Color.adminChat, message);
      } catch {
        // Слот пустой.
      }
    });
  } catch {
    // players недоступен.
  }
}

function bumpSoftStrike(player: Player, code: AcCode): number {
  const id = playerId(player);
  if (id === null) return 1;
  const state = getPlayerState(id);
  if (!state) return 1;

  const cfg = getConfig();
  const now = Date.now();
  const prevAt = state.strikeAt.get(code) ?? 0;
  if (now - prevAt > cfg.softStrikeDecayMs) {
    state.strikes.set(code, 0);
  }

  const next = (state.strikes.get(code) ?? 0) + 1;
  state.strikes.set(code, next);
  state.strikeAt.set(code, now);
  return next;
}

function kickPlayer(player: Player, label: string): void {
  try {
    player.sendClientMessage(
      Color.error,
      `Античит: ${label}. Вы отключены от сервера.`
    );
  } catch {
    // Уже вышел.
  }

  kickSamePlayer(
    player,
    Math.min(800, 150 + (() => {
      try {
        return player.getPing();
      } catch {
        return 100;
      }
    })())
  );
}

export function reportCheat(
  player: Player,
  code: AcCode,
  detail = ""
): void {
  if (!isCodeEnabled(code)) return;

  const id = playerId(player);
  if (id === null) return;

  const state = getPlayerState(id);
  if (state?.disabledCodes.has(code)) return;

  const cfg = getConfig();
  const name = playerChatName(player);
  const ip = playerIp(player);
  const label = codeName(code);
  const suffix = detail ? ` (${detail})` : "";

  if (onDetect) {
    const stop = onDetect(player, code, detail);
    if (stop === false) return;
  }

  const instant = INSTANT_KICK_CODES.has(code);
  const strike = instant ? cfg.softStrikeMax : bumpSoftStrike(player, code);
  const need = cfg.softStrikeMax;
  const softHit = !instant && strike < need;

  const line = softHit
    ? `[AC] ${name} - ${label}${suffix} [${strike}/${need}]`
    : `[AC] ${name} - ${label}${suffix}`;

  omp.log(`[${SERVER_TAG}] ${line} ip=${ip} code=${code}`);
  notifyAdmins(softHit ? `[AC] ${name}: ${label} (${strike}/${need})` : `[AC] ${name}: ${label}`);

  if (softHit) {
    try {
      player.sendClientMessage(
        Color.error,
        `Античит: подозрение (${label}). Предупреждение ${strike}/${need}.`
      );
    } catch {
      // Уже вышел.
    }
    return;
  }

  if (!cfg.kickOnDetect) {
    try {
      player.sendClientMessage(Color.error, `Античит: ${label} (кик выключен).`);
    } catch {
      // ignore
    }
    return;
  }

  if (state) {
    state.strikes.set(code, 0);
  }
  kickPlayer(player, label);
}

export function reportWarning(
  player: Player,
  code: AcCode,
  count: number,
  max: number,
  detail = ""
): boolean {
  if (!isCodeEnabled(code)) return false;

  const id = playerId(player);
  if (id === null) return false;
  const state = getPlayerState(id);
  if (state?.disabledCodes.has(code)) return false;

  const cfg = getConfig();
  if (cfg.debug) {
    omp.log(
      `[${SERVER_TAG}] [AC warn] ${playerChatName(player)} ${codeName(code)} ${count}/${max} ${detail}`
    );
  }

  if (count >= max) {
    reportCheat(player, code, detail || `${count}/${max}`);
    return true;
  }
  return false;
}

/** Сброс устаревших soft-страйков (вызывать из тика). */
export function decaySoftStrikes(): void {
  const cfg = getConfig();
  const now = Date.now();
  try {
    omp.players.forEach((player) => {
      const id = playerId(player);
      if (id === null) return;
      const state = getPlayerState(id);
      if (!state) return;
      for (const [code, at] of state.strikeAt) {
        if (now - at > cfg.softStrikeDecayMs) {
          state.strikes.delete(code);
          state.strikeAt.delete(code);
        }
      }
    });
  } catch {
    // ignore
  }
}
