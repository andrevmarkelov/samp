import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import type { GameModule } from "../types";
import { ensureWarehousesTable, listWarehouses } from "./repository";
import { startGangWarehouseDisplays } from "./gang-stock";
import { startMafiaWarehouseDisplays } from "./mafia-stock";

export {
  addMineMetal,
  addWarehouseMetal,
  takeMineMetal,
  takeWarehouseMetal,
  getWarehouse,
  listWarehouses,
  warehouseUsesLock,
  WAREHOUSE_IDS,
  WAREHOUSE_LOCKABLE_IDS,
  WAREHOUSE_MINE_ID,
} from "./repository";
export type { WarehouseRecord } from "./repository";
export { refreshGangWarehouseLabels } from "./gang-stock";
export { refreshMafiaWarehouseLabels } from "./mafia-stock";

export const warehouseModule: GameModule = {
  name: "warehouse",
  async start() {
    if (!isDatabaseReady()) {
      omp.log(`[${SERVER_TAG}] склады: нет БД`);
      return;
    }

    try {
      await ensureWarehousesTable();
      startMafiaWarehouseDisplays();
      startGangWarehouseDisplays();
      omp.log(`[${SERVER_TAG}] склады: загружено ${listWarehouses().length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] склады: ошибка загрузки — ${message}`);
    }
  },
};
