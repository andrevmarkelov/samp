import type { GameModule } from "../types";
import { bindBusShifts } from "./bus/shift";
import { spawnBusJobVehicles } from "./bus/vehicles";
import { bindFirefighter } from "./firefighter";
import { bindJobHire } from "./hire";

export {
  JOB_NONE,
  JOB_BUS_DRIVER,
  JOB_FIREFIGHTER,
  getJob,
  jobLabel,
  isKnownJobId,
} from "./catalog";
export { isBusDriverOnShift } from "./bus/active";
export { isFirefighterOnShift } from "./firefighter/active";
export { JOB_HIRE_DIALOG_ID } from "./hire";
export {
  BUS_CONFIRM_DIALOG_ID,
  BUS_FARE_DIALOG_ID,
  BUS_ROUTE_DIALOG_ID,
} from "./bus/shift";

export const jobsModule: GameModule = {
  name: "jobs",
  start() {
    bindJobHire();
    bindBusShifts();
    spawnBusJobVehicles();
    bindFirefighter();
  },
};
