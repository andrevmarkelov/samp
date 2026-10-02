import { omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import type { BusinessRecord } from "./repository";
import { listBusinesses } from "./repository";
import { businessMapIconType } from "./types";

/** Слоты 11–49 заняты домами. */
const MAP_ICON_SLOT_MIN = 50;
const MAP_ICON_SLOT_MAX = 99;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const TICK_MS = 200;

type ActiveIcon = {
  slot: number;
  typeId: number;
};

type PlayerIconState = {
  active: Map<number, ActiveIcon>;
  freeSlots: number[];
};

const playerIcons = new Map<number, PlayerIconState>();

function createSlotPool(): number[] {
  const slots: number[] = [];
  for (let slot = MAP_ICON_SLOT_MAX; slot >= MAP_ICON_SLOT_MIN; slot -= 1) {
    slots.push(slot);
  }
  return slots;
}

function getState(id: number): PlayerIconState {
  let state = playerIcons.get(id);
  if (!state) {
    state = {
      active: new Map(),
      freeSlots: createSlotPool(),
    };
    playerIcons.set(id, state);
  }
  return state;
}

export function bindBusinessMapIcons(): void {
  setInterval(tickBusinessIcons, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    clearPlayerIcons(player, id);
    playerIcons.delete(id);
  });
}

export function refreshBusinessMapIcons(player: Player): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  try {
    const pos = player.getPos();
    const world = player.getVirtualWorld();
    const interior = player.getInterior();
    updatePlayerIcons(player, id, pos.x, pos.y, world, interior);
  } catch {
    // Игрок уже вышел.
  }
}

function tickBusinessIcons(): void {
  const businesses = listBusinesses();
  if (businesses.length === 0) {
    return;
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      updatePlayerIcons(player, id, pos.x, pos.y, world, interior, businesses);
    } catch {
      // Игрок уже вышел.
    }
  });
}

function updatePlayerIcons(
  player: Player,
  id: number,
  x: number,
  y: number,
  world: number,
  interior: number,
  businesses: readonly BusinessRecord[] = listBusinesses()
): void {
  const state = getState(id);

  if (world !== STREET_WORLD || interior !== 0) {
    if (state.active.size > 0) {
      clearPlayerIcons(player, id);
    }
    return;
  }

  const nearby = collectNearbyBusinesses(businesses, x, y);
  const nearbyIds = new Set(nearby.map((item) => item.id));

  for (const [businessId, icon] of state.active) {
    if (nearbyIds.has(businessId)) {
      continue;
    }

    hideBusinessIcon(player, state, businessId, icon.slot);
  }

  for (const business of nearby) {
    const current = state.active.get(business.id);

    if (current) {
      if (current.typeId !== business.typeId) {
        showBusinessIcon(player, business, current.slot);
        state.active.set(business.id, { slot: current.slot, typeId: business.typeId });
      }
      continue;
    }

    const slot = takeSlot(state);
    if (slot === null) {
      break;
    }

    showBusinessIcon(player, business, slot);
    state.active.set(business.id, { slot, typeId: business.typeId });
  }
}

function collectNearbyBusinesses(
  businesses: readonly BusinessRecord[],
  x: number,
  y: number
): BusinessRecord[] {
  const nearby: Array<{ business: BusinessRecord; distance: number }> = [];

  for (const business of businesses) {
    const distance = Math.hypot(x - business.entranceX, y - business.entranceY);
    if (distance > ICON_RADIUS) {
      continue;
    }

    nearby.push({ business, distance });
  }

  nearby.sort((left, right) => left.distance - right.distance);
  const maxIcons = MAP_ICON_SLOT_MAX - MAP_ICON_SLOT_MIN + 1;
  return nearby.slice(0, maxIcons).map((item) => item.business);
}

function takeSlot(state: PlayerIconState): number | null {
  return state.freeSlots.pop() ?? null;
}

function releaseSlot(state: PlayerIconState, slot: number): void {
  state.freeSlots.push(slot);
}

function showBusinessIcon(player: Player, business: BusinessRecord, slot: number): void {
  try {
    player.setMapIcon(
      slot,
      business.entranceX,
      business.entranceY,
      business.entranceZ,
      businessMapIconType(business.typeId),
      0,
      MAPICON_LOCAL
    );
  } catch {
    // Игрок уже вышел.
  }
}

function hideBusinessIcon(
  player: Player,
  state: PlayerIconState,
  businessId: number,
  slot: number
): void {
  try {
    player.removeMapIcon(slot);
  } catch {
    // Иконки не было.
  }

  state.active.delete(businessId);
  releaseSlot(state, slot);
}

function clearPlayerIcons(player: Player, id: number): void {
  const state = playerIcons.get(id);
  if (!state) {
    return;
  }

  for (const [businessId, icon] of state.active) {
    hideBusinessIcon(player, state, businessId, icon.slot);
  }
}
