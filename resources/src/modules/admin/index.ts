import { omp } from "@omp-node/core";
import type { GameModule } from "../types";
import { bindAdminsList } from "./admins";
import { bindAdminAo } from "./ao";
import { bindAlogin, clearAloginDialog } from "./alogin";
import { bindAdminHelp } from "./ahelp";
import { bindAdminAns } from "./ans";
import { bindAdminChat } from "./chat";
import { bindAdminKick } from "./kick";
import { bindAdminMute } from "./mute";
import { bindAdminSethp } from "./sethp";
import { bindAdminSetlevel } from "./setlevel";
import { bindAdminSetskin } from "./setskin";
import { bindAdminGivemoney } from "./givemoney";
import { bindAdminMakeadmin } from "./makeadmin";
import { bindAdminMakeleader } from "./makeleader";
import { bindAdminGzcolor } from "./gzcolor";
import { bindAdminMapTeleport } from "./map";
import { bindAdminRespcar } from "./respcar";
import { bindAdminTpcor } from "./tpcor";
import { bindAdminVeh } from "./veh";

export { isAdminLoggedIn } from "./session";

export const adminModule: GameModule = {
  name: "admin",
  start() {
    bindAlogin();
    bindAdminChat();
    bindAdminAns();
    bindAdminHelp();
    bindAdminsList();
    bindAdminKick();
    bindAdminMute();
    bindAdminAo();
    bindAdminTpcor();
    bindAdminVeh();
    bindAdminSethp();
    bindAdminSetskin();
    bindAdminRespcar();
    bindAdminMakeleader();
    bindAdminGzcolor();
    bindAdminGivemoney();
    bindAdminSetlevel();
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
