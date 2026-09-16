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
import "./pass";
import "./hospital";
import "./gps";
import "./leaders";
import "./r";
import "./limit";
import "./report";
import { bindMenuDialogs } from "./mn";
import { bindGpsDialogs } from "../gps";
import { bindReportDialogs } from "./report";

export const commandsModule: GameModule = {
  name: "commands",
  start() {
    bindCommandListener();
    bindMenuDialogs();
    bindGpsDialogs();
    bindReportDialogs();
  },
};
