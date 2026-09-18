import type { GameModule } from "../types";
import { bindOrgGates } from "./gates";
import { bindHospitalRoofAccess } from "./hospital-roof";
import { bindMeriyaStaffDoors } from "./meriya-doors";
import { bindMeriyaLocker } from "./meriya-locker";

export const orgModule: GameModule = {
  name: "org",
  start() {
    bindOrgGates();
    bindHospitalRoofAccess();
    bindMeriyaStaffDoors();
    bindMeriyaLocker();
  },
};
