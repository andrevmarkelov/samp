import type { GameModule } from "../types";
import { bindEventCommands } from "./commands";
import { bindCounterStrike } from "./cs";
import { bindRace } from "./race";
import { bindEventSchedule } from "./schedule";

export const eventsModule: GameModule = {
  name: "events",
  start() {
    bindEventCommands();
    bindCounterStrike();
    bindRace();
    bindEventSchedule();
  },
};
