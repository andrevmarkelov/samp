import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";
import { AcCode, PLAYER_STATE, SPECIAL_ACTION } from "../codes";
import { getConfig, isCodeEnabled } from "../config";
import { dist3, nowMs, speedFromVelocity } from "../math";
import { reportCheat, reportWarning } from "../punish";
import { getPlayerState } from "../state";

const FLY_ANIMS = new Set([
  1538, 1539, 1540, 1541, 1542, 1543, 1544, 156, 157, 158, 159, 160, 161, 162,
  958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 970, 971, 972,
  973, 974, 975, 976, 977, 978, 979, 1055, 1056, 1057, 1058, 1059,
]);

export function checkMovement(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned || state.dead || state.spectating) return;

  const cfg = getConfig();
  const now = nowMs();
  const dtSec = Math.min(1.5, Math.max(0.03, (now - state.lastUpdateAt) / 1000));

  if (now < state.posTrustedUntil) {
    try {
      const pos = player.getPos();
      state.x = pos.x;
      state.y = pos.y;
      state.z = pos.z;
      const vel = player.getVelocity();
      state.speed = speedFromVelocity(vel.x, vel.y, vel.z);
      state.lastUpdateAt = now;
    } catch {
      // ignore
    }
    return;
  }

  let pos: { x: number; y: number; z: number };
  let vel: { x: number; y: number; z: number };
  let pState: number;
  try {
    pos = player.getPos();
    vel = player.getVelocity();
    pState = player.getState();
  } catch {
    return;
  }

  const speed = speedFromVelocity(vel.x, vel.y, vel.z);
  const dist = dist3(state.x, state.y, state.z, pos.x, pos.y, pos.z);
  const inVeh =
    pState === PLAYER_STATE.driver || pState === PLAYER_STATE.passenger;

  // Ожидаемый путь с запасом на лаг (velocity SA → м/с ≈ speed/179).
  const expected = (speed / 179.28625) * dtSec * 2.2 + 2.5;

  if (!inVeh && isCodeEnabled(AcCode.SpeedHackFoot) && speed > cfg.speedFootMax) {
    state.warnSpeedFoot += 1;
    if (
      reportWarning(
        player,
        AcCode.SpeedHackFoot,
        state.warnSpeedFoot,
        cfg.speedWarnings,
        `spd=${speed}`
      )
    ) {
      state.warnSpeedFoot = 0;
      return;
    }
  }

  if (inVeh && isCodeEnabled(AcCode.SpeedHackVeh) && speed > cfg.speedVehMax) {
    state.warnSpeedVeh += 1;
    if (
      reportWarning(
        player,
        AcCode.SpeedHackVeh,
        state.warnSpeedVeh,
        cfg.speedWarnings,
        `spd=${speed}`
      )
    ) {
      state.warnSpeedVeh = 0;
      return;
    }
  }

  if (
    !inVeh &&
    isCodeEnabled(AcCode.TeleportFoot) &&
    dist >= cfg.teleportFootDist &&
    dist > expected + 15
  ) {
    reportCheat(player, AcCode.TeleportFoot, `d=${dist.toFixed(1)}`);
    return;
  }

  if (
    inVeh &&
    isCodeEnabled(AcCode.TeleportVeh) &&
    dist >= cfg.teleportVehDist &&
    dist > expected + 20
  ) {
    reportCheat(player, AcCode.TeleportVeh, `d=${dist.toFixed(1)}`);
    return;
  }

  if (!inVeh && isCodeEnabled(AcCode.AirBreakFoot) && dist > expected && dist > 1.5 && dist < 40) {
    const limit = dist < 8 ? dist * 12 : dist * 5;
    if (speed < limit) {
      state.warnAirFoot += 1;
      if (
        reportWarning(
          player,
          AcCode.AirBreakFoot,
          state.warnAirFoot,
          cfg.airBreakWarnings,
          `d=${dist.toFixed(1)} spd=${speed}`
        )
      ) {
        state.warnAirFoot = 0;
        return;
      }
    }
  }

  if (
    inVeh &&
    isCodeEnabled(AcCode.AirBreakVeh) &&
    speed < 12 &&
    dist > Math.max(0.8, expected) &&
    dist < 40
  ) {
    state.warnAirVeh += 1;
    if (
      reportWarning(
        player,
        AcCode.AirBreakVeh,
        state.warnAirVeh,
        cfg.airBreakVehWarnings,
        `d=${dist.toFixed(1)}`
      )
    ) {
      state.warnAirVeh = 0;
      return;
    }
  }

  if (!inVeh && isCodeEnabled(AcCode.FlyHackFoot)) {
    try {
      const anim = player.getAnimationIndex();
      const action = player.getSpecialAction();
      if (action === SPECIAL_ACTION.jetpack && state.specialAction !== SPECIAL_ACTION.jetpack) {
        reportCheat(player, AcCode.SpecialAction, "jetpack");
        return;
      }
      if (FLY_ANIMS.has(anim) && speed > 40 && vel.z > 0.05) {
        state.warnFly += 1;
        if (
          reportWarning(
            player,
            AcCode.FlyHackFoot,
            state.warnFly,
            cfg.flyWarnings,
            `anim=${anim}`
          )
        ) {
          state.warnFly = 0;
          return;
        }
      }
    } catch {
      // ignore
    }
  }

  if (inVeh && isCodeEnabled(AcCode.FlyHackVeh)) {
    const dz = pos.z - state.z;
    if (dz > 3 && vel.z < 0.01 && speed > 30) {
      state.warnFly += 1;
      if (
        reportWarning(
          player,
          AcCode.FlyHackVeh,
          state.warnFly,
          cfg.flyWarnings,
          `dz=${dz.toFixed(1)}`
        )
      ) {
        state.warnFly = 0;
        return;
      }
    }
  }

  if (!inVeh && isCodeEnabled(AcCode.CjRun)) {
    const horiz = Math.hypot(vel.x, vel.y);
    if (horiz > 0.55 && Math.abs(vel.z) < 0.02 && speed > 180 && speed < 400) {
      reportCheat(player, AcCode.CjRun, `h=${horiz.toFixed(2)}`);
      return;
    }
  }

  state.x = pos.x;
  state.y = pos.y;
  state.z = pos.z;
  state.speed = speed;
  state.lastUpdateAt = now;
}
