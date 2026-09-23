import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";
import { AcCode, PLAYER_STATE } from "../codes";
import { getConfig, isCodeEnabled } from "../config";
import { nowMs } from "../math";
import { reportCheat, reportWarning } from "../punish";
import { getPlayerState } from "../state";

const KEY_FIRE = 4;

export function noteFlood(player: Player, key: string): void {
  if (!isCodeEnabled(AcCode.CallbackFlood)) return;
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state) return;

  const cfg = getConfig();
  const now = nowMs();
  const list = state.warnFlood.get(key) ?? [];
  const fresh = list.filter((t) => now - t < cfg.floodWindowMs);
  fresh.push(now);
  state.warnFlood.set(key, fresh);

  if (fresh.length > cfg.floodMaxEvents) {
    reportWarning(
      player,
      AcCode.CallbackFlood,
      fresh.length,
      cfg.floodMaxEvents + 2,
      key
    );
    state.warnFlood.set(key, []);
  }
}

export function checkPingAndDos(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned) return;
  const cfg = getConfig();

  try {
    const ping = player.getPing();
    if (isCodeEnabled(AcCode.HighPing) && ping > cfg.maxPing) {
      state.warnPing += 1;
      if (
        reportWarning(
          player,
          AcCode.HighPing,
          state.warnPing,
          cfg.maxPingWarnings,
          `ping=${ping}`
        )
      ) {
        state.warnPing = 0;
      }
    } else {
      state.warnPing = Math.max(0, state.warnPing - 1);
    }
  } catch {
    // ignore
  }

  if (isCodeEnabled(AcCode.Dos)) {
    try {
      const mps = player.netStatsMessagesRecvPerSecond();
      if (mps > 400) {
        reportCheat(player, AcCode.Dos, `mps=${mps}`);
      }
    } catch {
      // ignore
    }
  }
}

export function onTakeDamage(
  player: Player,
  amount: number,
  weaponId: number
): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned) return;

  if (amount <= 0 && isCodeEnabled(AcCode.GodModeFoot)) {
    let pState = Number(PLAYER_STATE.onfoot);
    try {
      pState = player.getState();
    } catch {
      // ignore
    }
    if (pState === PLAYER_STATE.driver || pState === PLAYER_STATE.passenger) {
      if (isCodeEnabled(AcCode.GodModeVeh)) {
        reportCheat(player, AcCode.GodModeVeh, `w=${weaponId}`);
      }
    } else if (isCodeEnabled(AcCode.GodModeFoot)) {
      reportCheat(player, AcCode.GodModeFoot, `w=${weaponId}`);
    }
  }

  if (amount > 0) {
    // Сначала броня, потом HP — упрощённая модель.
    let left = amount;
    if (state.armour > 0) {
      const soak = Math.min(state.armour, left);
      state.armour -= soak;
      left -= soak;
    }
    if (left > 0) {
      state.health = Math.max(0, state.health - left);
    }
    state.healthTrustedUntil = nowMs() + 800;
    state.armourTrustedUntil = nowMs() + 800;
  }
}

export function onGiveDamage(player: Player): void {
  if (!isCodeEnabled(AcCode.RapidFire)) return;
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned) return;

  const now = nowMs();
  const cfg = getConfig();
  if (state.lastShotAt > 0) {
    const dt = now - state.lastShotAt;
    // Одинаковый тик / дробовик (несколько пеллетов) не считаем читом.
    if (dt > 0 && dt < cfg.rapidFireMinMs) {
      state.warnRapid += 1;
      if (
        reportWarning(
          player,
          AcCode.RapidFire,
          state.warnRapid,
          6,
          `dt=${dt}`
        )
      ) {
        state.warnRapid = 0;
      }
      return;
    }
  }
  state.lastShotAt = now;
  state.warnRapid = Math.max(0, state.warnRapid - 1);
}

export function onFireKey(player: Player, newKeys: number, oldKeys: number): void {
  const pressed = (newKeys & KEY_FIRE) !== 0 && (oldKeys & KEY_FIRE) === 0;
  if (!pressed) return;
  noteFlood(player, "fire");
}

export function onDialogResponse(player: Player, dialogId: number): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state) return;

  noteFlood(player, "dialog");

  if (
    isCodeEnabled(AcCode.DialogHack) &&
    state.dialogId >= 0 &&
    dialogId !== state.dialogId
  ) {
    reportCheat(player, AcCode.DialogHack, `got=${dialogId} exp=${state.dialogId}`);
  }
  state.dialogId = -1;
}
