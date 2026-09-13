import { omp } from "@omp-node/core";
import type { GameModule } from "../types";
import { bindAdminsList } from "./admins";
import { bindAlogin, clearAloginDialog } from "./alogin";
import { bindAdminHelp } from "./ahelp";
import { bindAdminChat } from "./chat";
import { bindAdminKick } from "./kick";
import { bindAdminMapTeleport } from "./map";

export { isAdminLoggedIn } from "./session";

export const adminModule: GameModule = {
  name: "admin",
  start() {
    bindAlogin();
    bindAdminChat();
    bindAdminHelp();
    bindAdminsList();
    bindAdminKick();
    bindAdminMapTeleport();

    omp.on("playerConnect", (player) => {
      clearAloginDialog(player);
    });

    omp.on("playerDisconnect", (player) => {
      clearAloginDialog(player);
    });
  },
};
