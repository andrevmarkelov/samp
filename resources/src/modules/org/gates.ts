import { ObjectMp, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import { allOrgGates } from "./catalog";
import { getMembership } from "./membership";
import type { OrgGateDef } from "./types";

const KEY_CROUCH = 2;
const HOLD_OPEN_MS = 5000;
const MOVE_SPEED = 3;
const DRAW_DISTANCE = 280;
const DENY_COOLDOWN_MS = 2500;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;

type LiveGate = {
  def: OrgGateDef;
  object: ObjectMp;
  closeTimer: ReturnType<typeof setTimeout> | null;
};

const gates: LiveGate[] = [];
const denyAt = new Map<number, number>();

function canUseKeys(player: Player): boolean {
  try {
    const state = player.getState();
    return (
      state === PLAYER_STATE_ONFOOT ||
      state === PLAYER_STATE_DRIVER ||
      state === PLAYER_STATE_PASSENGER
    );
  } catch {
    return false;
  }
}

function travelMs(def: OrgGateDef): number {
  const dist = Math.abs(def.zClosed - def.zOpen);
  return Math.max(400, Math.round((dist / MOVE_SPEED) * 1000));
}

function moveGate(gate: LiveGate, z: number): void {
  const { def, object } = gate;
  try {
    if (object.isMoving()) {
      object.stop();
    }
    object.move(def.x, def.y, z, MOVE_SPEED, def.rx, def.ry, def.rz);
  } catch {
    // Объект ещё не готов.
  }
}

function openGate(gate: LiveGate): void {
  if (gate.closeTimer) {
    clearTimeout(gate.closeTimer);
    gate.closeTimer = null;
  }

  moveGate(gate, gate.def.zOpen);
  gate.closeTimer = setTimeout(() => {
    gate.closeTimer = null;
    moveGate(gate, gate.def.zClosed);
  }, travelMs(gate.def) + HOLD_OPEN_MS);
}

function nearestGate(player: Player): LiveGate | null {
  let best: LiveGate | null = null;
  let bestDist = Infinity;

  try {
    if (player.getInterior() !== 0 || player.getVirtualWorld() !== STREET_WORLD) {
      return null;
    }

    for (const gate of gates) {
      const dist = player.getDistanceFromPoint(gate.def.x, gate.def.y, gate.def.zClosed);
      if (dist <= gate.def.radius && dist < bestDist) {
        best = gate;
        bestDist = dist;
      }
    }
  } catch {
    return null;
  }

  return best;
}

function denyOpen(player: Player, message: string): void {
  const id = playerId(player);
  const now = Date.now();
  if (id !== null) {
    const last = denyAt.get(id) ?? 0;
    if (now - last < DENY_COOLDOWN_MS) {
      return;
    }
    denyAt.set(id, now);
  }

  player.sendClientMessage(Color.error, message);
}

function onGateKey(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player) || !canUseKeys(player)) {
    return;
  }

  const gate = nearestGate(player);
  if (!gate) {
    return;
  }

  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!membership || membership.org.id !== gate.def.orgId) {
    denyOpen(player, gate.def.denyMessage);
    return;
  }

  openGate(gate);
}

export function bindOrgGates(): void {
  if (gates.length > 0) {
    return;
  }

  for (const def of allOrgGates()) {
    try {
      const object = new ObjectMp(
        def.model,
        def.x,
        def.y,
        def.zClosed,
        def.rx,
        def.ry,
        def.rz,
        DRAW_DISTANCE
      );
      gates.push({ def, object, closeTimer: null });
    } catch {
      // Лимит объектов.
    }
  }

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_CROUCH) === 0) {
      return;
    }

    onGateKey(player);
  });

  omp.on("playerConnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      denyAt.delete(id);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      denyAt.delete(id);
    }
  });
}
