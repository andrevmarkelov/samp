import { omp } from "@omp-node/core";
import type { GameModule } from "../types";
import { bindAdminsList } from "./admins";
import { bindAdminAo } from "./ao";
import { bindAlogin, clearAloginDialog } from "./alogin";
import { bindAdminHelp } from "./ahelp";
import { bindAdminChat } from "./chat";
import { bindAdminKick } from "./kick";
import { bindAdminSethp } from "./sethp";
import { bindAdminMakeadmin } from "./makeadmin";
import { bindAdminMakeleader } from "./makeleader";
import { bindAdminMapTeleport } from "./map";
import { bindAdminRespcar } from "./respcar";
import { bindAdminTpcor } from "./tpcor";

export { isAdminLoggedIn } from "./session";

export const adminModule: GameModule = {
  name: "admin",
  start() {
    bindAlogin();
    bindAdminChat();
    bindAdminHelp();
    bindAdminsList();
    bindAdminKick();
    bindAdminAo();
    bindAdminTpcor();
    bindAdminSethp();
    bindAdminRespcar();
    bindAdminMakeleader();
    bindAdminMakeadmin();
    bindAdminMapTeleport();

    omp.on("playerConnect", (player) => {
      clearAloginDialog(player);
    });

    omp.on("playerDisconnect", (player) => {
      clearAloginDialog(player);
    });
  },
};
