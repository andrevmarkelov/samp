import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  MAX_HEALTH,
  applyHealth,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { listFamilies } from "./catalog";
import {
  familyIdFromVirtualWorld,
  familyVirtualWorld,
  isFamilyVirtualWorld,
} from "./world";

const HEART_PICKUP = 1240;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const TICK_MS = 200;
const MSG_COOLDOWN_MS = 3000;

/** Пикап здоровья в общем интерьере фамильного дома (свой VW у каждой семьи). */
const HEAL_POINT = {
  x: 197.4698,
  y: 13.3281,
  z: 1500.99,
  interior: 0,
} as const;

type HealProps = {
  pickup: Pickup;
  label: TextLabel;
};

const healByFamily = new Map<number, HealProps>();
const standingOn = new Set<number>();
const lastMsgAt = new Map<number, number>();

export function startFamilyHealPickups(): void {
  for (const family of listFamilies()) {
    ensureFamilyHealPickup(family.id);
  }

  setInterval(tickFamilyHeal, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    standingOn.delete(id);
    lastMsgAt.delete(id);
  });
}

export function ensureFamilyHealPickup(familyId: number): void {
  if (healByFamily.has(familyId)) {
    return;
  }

  const world = familyVirtualWorld(familyId);
  const pickup = new Pickup(
    HEART_PICKUP,
    PICKUP_TYPE,
    HEAL_POINT.x,
    HEAL_POINT.y,
    HEAL_POINT.z,
    world
  );
  const label = new TextLabel(
    "Здоровье",
    Color.info,
    HEAL_POINT.x,
    HEAL_POINT.y,
    HEAL_POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );

  healByFamily.set(familyId, { pickup, label });
}

export function removeFamilyHealPickup(familyId: number): void {
  const props = healByFamily.get(familyId);
  if (!props) {
    return;
  }

  try {
    props.pickup.destroy();
  } catch {
    // Уже уничтожен.
  }

  try {
    props.label.destroy();
  } catch {
    // Уже уничтожен.
  }

  healByFamily.delete(familyId);
}

function tickFamilyHeal(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(id);
        return;
      }

      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      if (!isFamilyVirtualWorld(world) || interior !== HEAL_POINT.interior) {
        standingOn.delete(id);
        return;
      }

      const familyId = familyIdFromVirtualWorld(world);
      const account = getAccount(player);
      if (
        familyId === null ||
        !account ||
        account.familyId !== familyId ||
        !healByFamily.has(familyId)
      ) {
        standingOn.delete(id);
        return;
      }

      const pos = player.getPos();
      const onPickup =
        Math.hypot(
          pos.x - HEAL_POINT.x,
          pos.y - HEAL_POINT.y,
          pos.z - HEAL_POINT.z
        ) <= PICKUP_RADIUS;

      if (!onPickup) {
        standingOn.delete(id);
        return;
      }

      if (standingOn.has(id)) {
        return;
      }

      standingOn.add(id);
      tryHeal(player);
    } catch {
      standingOn.delete(id);
    }
  });
}

function tryHeal(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (account.hospitalized) {
    tell(player, Color.error, "Сначала пройдите лечение в больнице.");
    return;
  }

  let current = account.health;
  try {
    const live = player.getHealth();
    if (live > 0) {
      current = live;
    }
  } catch {
    // Берём HP из аккаунта.
  }

  if (current >= MAX_HEALTH) {
    tell(player, Color.info, "У вас полное здоровье.");
    return;
  }

  applyHealth(player, MAX_HEALTH);
  patchAccount(player, { health: MAX_HEALTH });
  tell(player, Color.info, "Здоровье восстановлено.");
}

function tell(player: Player, color: number, text: string): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const last = lastMsgAt.get(id) ?? 0;
  if (now - last < MSG_COOLDOWN_MS) {
    return;
  }

  lastMsgAt.set(id, now);
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Игрок уже вышел.
  }
}
