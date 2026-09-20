import type { GameModule } from "../types";
import { bindCommandListener } from "./registry";
import "./help";
import "./me";
import "./do";
import "./try";
import "./todo";
import "./b";
import "./s";
import "./w";
import "./stats";
import "./time";
import "./pass";
import "./lic";
import "./selllic";
import "./hospital";
import "./gps";
import "./leaders";
import "./r";
import "./f";
import "./capture";
import "./d";
import "./gov";
import "./limit";
import "./report";
import { bindMenuDialogs } from "./mn";
import { bindGpsDialogs } from "../gps";
import { bindReportDialogs } from "./report";
import { bindOrgStaff } from "./org-staff";
import { bindSellLic } from "./selllic";
import { bindTimeLabels } from "./time";

export const commandsModule: GameModule = {
  name: "commands",
  start() {
    bindCommandListener();
    bindMenuDialogs();
    bindGpsDialogs();
    bindReportDialogs();
    bindOrgStaff();
    bindSellLic();
    bindTimeLabels();
  },
};
