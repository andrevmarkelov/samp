import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { isCuffed } from "../cuff";
import { canLawSearchTarget, isLawOfficer } from "../org/law";
import { isJailed } from "../prison/sentence";

const DENY = "Команда доступна сотрудникам полиции и FBI.";
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

export type LawTargetResult =
  | { ok: true; officer: Player; target: Player; officerId: number; targetId: number }
  | { ok: false };

/** Общий разбор `/cmd [id]` для law-обыска / изъятия / наручников. */
export function resolveLawNearbyTarget(
  officer: Player,
  args: string,
  usage: string
): LawTargetResult {
  if (!isAuthenticated(officer) || !isLawOfficer(officer)) {
    officer.sendClientMessage(Color.error, DENY);
    return { ok: false };
  }

  if (isJailed(officer)) {
    officer.sendClientMessage(Color.error, "В тюрьме команда недоступна.");
    return { ok: false };
  }

  if (isCuffed(officer)) {
    officer.sendClientMessage(Color.error, "В наручниках команда недоступна.");
    return { ok: false };
  }

  const raw = args.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    officer.sendClientMessage(Color.error, usage);
    return { ok: false };
  }

  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0) {
    officer.sendClientMessage(Color.error, usage);
    return { ok: false };
  }

  const officerId = playerId(officer);
  if (officerId === null) {
    return { ok: false };
  }

  if (slot === officerId) {
    officer.sendClientMessage(Color.error, "Нельзя применить к себе.");
    return { ok: false };
  }

  const target = findPlayer(slot);
  if (!target) {
    officer.sendClientMessage(Color.error, "Игрок не найден.");
    return { ok: false };
  }

  try {
    const officerState = officer.getState();
    if (
      officerState === PLAYER_STATE_WASTED ||
      officerState === PLAYER_STATE_SPECTATING
    ) {
      officer.sendClientMessage(Color.error, "Сейчас команда недоступна.");
      return { ok: false };
    }

    const targetState = target.getState();
    if (
      targetState === PLAYER_STATE_WASTED ||
      targetState === PLAYER_STATE_SPECTATING
    ) {
      officer.sendClientMessage(Color.error, "Игрок не в игре.");
      return { ok: false };
    }
  } catch {
    officer.sendClientMessage(Color.error, "Игрок не найден.");
    return { ok: false };
  }

  if (!arePlayersNearby(officer, target, WHISPER_RADIUS)) {
    officer.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return { ok: false };
  }

  if (!canLawSearchTarget(officer, target)) {
    officer.sendClientMessage(
      Color.error,
      "Полиция может применять команду только к гражданским. FBI — к любым (в т.ч. полиции)."
    );
    return { ok: false };
  }

  const targetId = playerId(target);
  if (targetId === null) {
    return { ok: false };
  }

  return { ok: true, officer, target, officerId, targetId };
}

function findPlayer(slot: number): Player | null {
  try {
    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      return null;
    }

    if (target.isNPC()) {
      return null;
    }

    if (!getAccount(target)) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}
