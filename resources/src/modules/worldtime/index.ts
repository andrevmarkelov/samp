import { Core, omp, type Player } from "@omp-node/core";
import type { GameModule } from "../types";

const SYNC_MS = 60_000;

function localClock(): { hour: number; minute: number } {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

function applyToPlayer(player: Player, hour: number, minute: number): void {
  try {
    if (player.isNPC()) {
      return;
    }
    player.setTime(hour, minute);
  } catch {
    /* disconnected */
  }
}

function syncWorldTime(): void {
  const { hour, minute } = localClock();
  try {
    Core.setWorldTime(hour);
  } catch {
    /* core not ready */
  }
  for (const player of omp.players.all()) {
    applyToPlayer(player, hour, minute);
  }
}

export const worldTimeModule: GameModule = {
  name: "worldtime",
  start() {
    syncWorldTime();
    setInterval(syncWorldTime, SYNC_MS);

    omp.on("playerConnect", (player) => {
      const { hour, minute } = localClock();
      applyToPlayer(player, hour, minute);
    });

    omp.on("playerSpawn", (player) => {
      const { hour, minute } = localClock();
      applyToPlayer(player, hour, minute);
    });
  },
};
