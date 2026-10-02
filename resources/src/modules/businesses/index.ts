import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import { playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";
import { startBusinessEntrances } from "./enter";
import { startBusinessExits } from "./exits";
import { bindBusinessMapIcons, refreshBusinessMapIcons } from "./map-icons";
import { startBusinessMarkers } from "./markers";
import { bindBusinessMenu } from "./menu";
import { bindBusinessPurchase } from "./purchase";
import { ensureBusinessesTable, listBusinesses } from "./repository";
import { startStreetFoodStalls } from "./street-food";
import { notifyBusinessTaxReminder, startBusinessTaxScheduler } from "./tax";

const taxReminderShown = new Set<number>();

export const businessesModule: GameModule = {
  name: "businesses",
  async start() {
    if (!isDatabaseReady()) {
      omp.log(`[${SERVER_TAG}] бизнесы: нет БД`);
      return;
    }

    try {
      await ensureBusinessesTable();
      startBusinessMarkers();
      startBusinessEntrances();
      startBusinessExits();
      startStreetFoodStalls();
      bindBusinessMapIcons();
      bindBusinessPurchase();
      bindBusinessMenu();
      startBusinessTaxScheduler();
      omp.log(`[${SERVER_TAG}] бизнесы: загружено ${listBusinesses().length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] бизнесы: ошибка загрузки — ${message}`);
    }

    omp.on("playerSpawn", (player) => {
      refreshBusinessMapIcons(player);
      remindBusinessTaxOnLogin(player);
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        taxReminderShown.delete(id);
      }
    });
  },
};

function remindBusinessTaxOnLogin(player: Player): void {
  if (!isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null || taxReminderShown.has(id)) {
    return;
  }

  taxReminderShown.add(id);
  notifyBusinessTaxReminder(player);
}
