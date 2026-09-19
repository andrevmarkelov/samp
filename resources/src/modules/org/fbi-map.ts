import { omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";

const POINT = {
  x: 606.9069,
  y: -1462.4832,
  z: 14.4439,
} as const;

const MAP_ICON_SLOT = 9;
const MAP_ICON_TYPE = 30;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const TICK_MS = 200;

const iconShown = new Set<number>();

export function bindFbiMapIcon(): void {
  setInterval(tickFbiIcon, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      iconShown.delete(id);
    }
  });
}

function tickFbiIcon(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      updateIcon(player, pos.x, pos.y, world, interior);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function updateIcon(
  player: Player,
  x: number,
  y: number,
  world: number,
  interior: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const near =
    world === STREET_WORLD &&
    interior === 0 &&
    Math.hypot(x - POINT.x, y - POINT.y) <= ICON_RADIUS;

  if (near) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        MAP_ICON_SLOT,
        POINT.x,
        POINT.y,
        POINT.z,
        MAP_ICON_TYPE,
        0,
        MAPICON_LOCAL
      );
      iconShown.add(id);
    } catch {
      // Игрок уже вышел.
    }
    return;
  }

  if (!iconShown.has(id)) {
    return;
  }

  try {
    player.removeMapIcon(MAP_ICON_SLOT);
  } catch {
    // Игрок уже вышел.
  }
  iconShown.delete(id);
}
