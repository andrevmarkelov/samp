import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import type { GameModule } from "../types";
import { ensureWarehousesTable, listWarehouses } from "./repository";
import { startGangWarehouseDisplays } from "./gang-stock";
import { startMafiaWarehouseDisplays } from "./mafia-stock";
import { bindOrgWarehouseInteract } from "./stock-interact";

export {
  addMineMetal,
  addWarehouseAmmo,
  addWarehouseDrugs,
  addWarehouseMeds,
  addWarehouseMetal,
  takeMineMetal,
  takeWarehouseAmmo,
  takeWarehouseDrugs,
  takeWarehouseMeds,
  takeWarehouseMetal,
  setWarehouseLocked,
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
export {
  ORG_WAREHOUSE_MENU_DIALOG_ID,
  ORG_WAREHOUSE_AMOUNT_DIALOG_ID,
} from "./stock-interact";

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
      bindOrgWarehouseInteract();
      omp.log(`[${SERVER_TAG}] склады: загружено ${listWarehouses().length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] склады: ошибка загрузки — ${message}`);
    }
  },
};
