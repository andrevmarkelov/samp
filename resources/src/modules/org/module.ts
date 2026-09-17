import type { GameModule } from "../types";
import { bindOrgGates } from "./gates";
import { bindHospitalRoofAccess } from "./hospital-roof";

export const orgModule: GameModule = {
  name: "org",
  start() {
    bindOrgGates();
    bindHospitalRoofAccess();
  },
};
