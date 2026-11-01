import type { GameModule } from "../types";
import { bindCounterStrike } from "./cs";
import { bindEventSchedule } from "./schedule";

export const eventsModule: GameModule = {
  name: "events",
  start() {
    bindCounterStrike();
    bindEventSchedule();
  },
};
