import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import type { GameModule } from "../types";
import { bindFamilyCommands } from "./commands";
import { startFamilyCreateOffice } from "./create-office";
import { startFamilyHealPickups } from "./heal";
import { startFamilyHome } from "./home";
import { bindFamilyMenu } from "./menu";
import { ensureFamiliesTable, listFamilies } from "./repository";
import { bindFamilyWarehouseInteract } from "./stock";
import { startFamilyWarehouseDisplay } from "./stock-display";
import { startFamilyTags } from "./tags";

export {
  FAMILY_NONE,
  FAMILY_CREATE_COST,
  FAMILY_CREATE_MIN_LEVEL,
  FAMILY_STAFF_MIN_RANK,
  FAMILY_MANAGE_MAX_RANK,
  MAX_FAMILY_RANK,
  MIN_FAMILY_RANK,
} from "./types";
export type { FamilyRecord, FamilyRankDef } from "./types";
export {
  getFamilyMembership,
  isFamilyOwner,
  isFamilyStaff,
} from "./membership";
export { parseFamilyId, parseFamilyRank } from "./types";
export { getFamily, listFamilies } from "./catalog";
export { getFamilyRank, allFamilyRanks } from "./ranks";
export {
  FAMILY_INVITE_DIALOG_ID,
  bindFamilyCommands,
} from "./commands";
export {
  FAMILY_CREATE_CONFIRM_DIALOG_ID,
  FAMILY_CREATE_NAME_DIALOG_ID,
} from "./create-office";
export {
  FAMILY_MENU_DIALOG_ID,
  bindFamilyMenu,
} from "./menu";
export {
  FAMILY_WAREHOUSE_MENU_DIALOG_ID,
  FAMILY_WAREHOUSE_AMOUNT_DIALOG_ID,
} from "./stock";

export const familyModule: GameModule = {
  name: "family",
  async start() {
    if (!isDatabaseReady()) {
      omp.log(`[${SERVER_TAG}] семьи: нет БД`);
      return;
    }

    try {
      await ensureFamiliesTable();
      startFamilyCreateOffice();
      startFamilyHome();
      startFamilyWarehouseDisplay();
      startFamilyHealPickups();
      bindFamilyWarehouseInteract();
      bindFamilyCommands();
      bindFamilyMenu();
      startFamilyTags();
      omp.log(`[${SERVER_TAG}] семьи: загружено ${listFamilies().length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] семьи: ошибка загрузки — ${message}`);
    }
  },
};
