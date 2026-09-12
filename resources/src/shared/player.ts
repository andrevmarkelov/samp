import type { Player } from "@omp-node/core";

export function playerName(player: Player): string {
  try {
    return player.getName().name || "Неизвестный";
  } catch {
    return "Неизвестный";
  }
}

export function isPlayerActive(player: Player): boolean {
  try {
    return player.getPtr() !== null;
  } catch {
    return false;
  }
}

export function playerId(player: Player): number | null {
  try {
    const id = player.getID();
    if (id === null || id === undefined) {
      return null;
    }

    const numeric = Number(id);
    return Number.isInteger(numeric) ? numeric : null;
  } catch {
    return null;
  }
}
