import type { GameModule } from "../types";
import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { getConfig } from "./config";
import { bindAnticheat } from "./loop";

export { AcCode, NopCode } from "./codes";
export { getConfig, setCodeEnabled, setNopEnabled, isCodeEnabled } from "./config";
export { setCheatHandler } from "./punish";
export {
  trustPosition,
  trustMoney,
  trustHealth,
  trustArmour,
  trustWeapon,
  clearTrustedWeapons,
  trustVehicle,
  trustDialog,
  grantWeapon,
  grantArmour,
  setTrustedHealth,
  markSpawned,
  markSpectating,
} from "./trust";

export const anticheatModule: GameModule = {
  name: "anticheat",
  start() {
    const cfg = getConfig();
    bindAnticheat();
    omp.log(
      `[${SERVER_TAG}] anticheat: ${cfg.enabled ? "включён" : "выключен"}, kick=${cfg.kickOnDetect}`
    );
  },
};
