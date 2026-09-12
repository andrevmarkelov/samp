import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { playerName } from "../../shared/player";
import type { GameModule } from "../types";

export const sessionModule: GameModule = {
  name: "session",
  start() {
    omp.on("playerConnect", (player) => {
      omp.log(`[${SERVER_TAG}] ${playerName(player)} подключился`);
    });

    omp.on("playerDisconnect", (player) => {
      omp.log(`[${SERVER_TAG}] ${playerName(player)} отключился`);
    });
  },
};
