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

export const commandsModule: GameModule = {
  name: "commands",
  start() {
    bindCommandListener();
  },
};
