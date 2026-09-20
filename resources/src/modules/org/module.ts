import type { GameModule } from "../types";
import { bindOrgGates } from "./gates";
import { bindHospitalRoofAccess } from "./hospital-roof";
import { bindMeriyaStaffDoors } from "./meriya-doors";
import { bindMeriyaLocker } from "./meriya-locker";
import { bindPoliceDoors } from "./police-doors";
import { bindPoliceLocker } from "./police-locker";
import { bindFbiDoors } from "./fbi-doors";
import { bindFbiLocker } from "./fbi-locker";
import { bindFbiMapIcon } from "./fbi-map";
import { bindLspdDoors } from "./lspd-doors";
import { bindLspdLocker } from "./lspd-locker";
import { bindLspdMapIcon } from "./lspd-map";
import { bindAutoschoolDoors } from "./autoschool-doors";
import { bindAutoschoolMapIcon } from "./autoschool-map";
import { bindMafiaDoors } from "./mafia-doors";
import { bindGangDoors } from "./gang-doors";
import { bindPoliceMapIcon } from "./police-map";
import { bindRadioDoors } from "./radio-doors";
import { bindRadioLocker } from "./radio-locker";

export const orgModule: GameModule = {
  name: "org",
  start() {
    bindOrgGates();
    bindHospitalRoofAccess();
    bindMeriyaStaffDoors();
    bindMeriyaLocker();
    bindPoliceDoors();
    bindLspdDoors();
    bindPoliceLocker();
    bindLspdLocker();
    bindFbiLocker();
    bindPoliceMapIcon();
    bindLspdMapIcon();
    bindFbiDoors();
    bindFbiMapIcon();
    bindMafiaDoors();
    bindGangDoors();
    bindAutoschoolDoors();
    bindAutoschoolMapIcon();
    bindRadioDoors();
    bindRadioLocker();
  },
};
