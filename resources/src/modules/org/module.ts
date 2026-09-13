import type { GameModule } from "../types";
import { bindOrgGates } from "./gates";

export const orgModule: GameModule = {
  name: "org",
  start() {
    bindOrgGates();
  },
};
