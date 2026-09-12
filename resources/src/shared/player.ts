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

export function playerIp(player: Player): string {
  try {
    const result = player.getIp();
    const raw = String(result?.ip ?? "").trim();
    const ipv4Port = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    const ip = ipv4Port?.[1] ?? raw;
    return ip.length > 45 ? ip.slice(0, 45) : ip;
  } catch {
    return "";
  }
}
