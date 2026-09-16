import { omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import type { GameModule } from "../types";

const POINT = {
  x: 1810.8636,
  y: -1576.4412,
  z: 13.5167,
} as const;

const MAP_ICON_SLOT = 4;
const MAP_ICON_TYPE = 30;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const TICK_MS = 200;

const iconShown = new Set<number>();

export const prisonModule: GameModule = {
  name: "prison",
  start() {
    setInterval(tickPrisonIcon, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        iconShown.delete(id);
      }
    });
  },
};

function tickPrisonIcon(): void {
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
