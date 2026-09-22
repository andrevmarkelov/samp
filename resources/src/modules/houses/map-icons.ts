import { omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import type { HouseRecord } from "./repository";
import { listHouses } from "./repository";

const MAP_ICON_SLOT_MIN = 11;
const MAP_ICON_SLOT_MAX = 99;
const ICON_FOR_SALE = 31;
const ICON_OWNED = 32;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const TICK_MS = 200;

type ActiveIcon = {
  slot: number;
  owned: boolean;
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

export function bindHouseMapIcons(): void {
  setInterval(tickHouseIcons, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    clearPlayerIcons(player, id);
    playerIcons.delete(id);
  });
}

export function refreshAllHouseMapIcons(): void {
  omp.players.forEach((player) => {
    refreshHouseMapIcons(player);
  });
}

export function refreshHouseMapIcons(player: Player): void {
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

function tickHouseIcons(): void {
  const houses = listHouses();
  if (houses.length === 0) {
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
      updatePlayerIcons(player, id, pos.x, pos.y, world, interior, houses);
    } catch {
      // Слот пустой или игрок уже вышел.
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
  houses: readonly HouseRecord[] = listHouses()
): void {
  const state = getState(id);

  if (world !== STREET_WORLD || interior !== 0) {
    if (state.active.size > 0) {
      clearPlayerIcons(player, id);
    }
    return;
  }

  const nearby = collectNearbyHouses(houses, x, y);
  const nearbyIds = new Set(nearby.map((house) => house.id));

  for (const [houseId, icon] of state.active) {
    if (nearbyIds.has(houseId)) {
      continue;
    }

    hideHouseIcon(player, state, houseId, icon.slot);
  }

  for (const house of nearby) {
    const owned = house.ownerId !== null;
    const current = state.active.get(house.id);

    if (current) {
      if (current.owned !== owned) {
        showHouseIcon(player, house, current.slot, owned);
        state.active.set(house.id, { slot: current.slot, owned });
      }
      continue;
    }

    const slot = takeSlot(state);
    if (slot === null) {
      break;
    }

    showHouseIcon(player, house, slot, owned);
    state.active.set(house.id, { slot, owned });
  }
}

function collectNearbyHouses(
  houses: readonly HouseRecord[],
  x: number,
  y: number
): HouseRecord[] {
  const nearby: Array<{ house: HouseRecord; distance: number }> = [];

  for (const house of houses) {
    const distance = Math.hypot(x - house.entranceX, y - house.entranceY);
    if (distance > ICON_RADIUS) {
      continue;
    }

    nearby.push({ house, distance });
  }

  nearby.sort((left, right) => left.distance - right.distance);
  const maxIcons = MAP_ICON_SLOT_MAX - MAP_ICON_SLOT_MIN + 1;
  return nearby.slice(0, maxIcons).map((item) => item.house);
}

function takeSlot(state: PlayerIconState): number | null {
  return state.freeSlots.pop() ?? null;
}

function releaseSlot(state: PlayerIconState, slot: number): void {
  state.freeSlots.push(slot);
}

function showHouseIcon(
  player: Player,
  house: HouseRecord,
  slot: number,
  owned: boolean
): void {
  try {
    player.setMapIcon(
      slot,
      house.entranceX,
      house.entranceY,
      house.entranceZ,
      owned ? ICON_OWNED : ICON_FOR_SALE,
      0,
      MAPICON_LOCAL
    );
  } catch {
    // Игрок уже вышел.
  }
}

function hideHouseIcon(
  player: Player,
  state: PlayerIconState,
  houseId: number,
  slot: number
): void {
  try {
    player.removeMapIcon(slot);
  } catch {
    // Иконки не было.
  }

  state.active.delete(houseId);
  releaseSlot(state, slot);
}

function clearPlayerIcons(player: Player, id: number): void {
  const state = playerIcons.get(id);
  if (!state) {
    return;
  }

  for (const [houseId, icon] of state.active) {
    hideHouseIcon(player, state, houseId, icon.slot);
  }
}
