import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerChatName } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";
import { clearTalk, playLocalSpeech } from "./talk";

export const chatModule: GameModule = {
  name: "chat",
  start() {
    omp.on("playerText", (player, raw) => {
      if (!isAuthenticated(player)) {
        return false;
      }

      const text = String(raw ?? "").trim().slice(0, CHAT_MAX_LENGTH);
      if (!text) {
        return false;
      }

      sendNearby(
        player,
        CHAT_RADIUS,
        Color.chat,
        `${playerChatName(player)}: ${text}`
      );
      playLocalSpeech(player, text);
      return false;
    });

    omp.on("playerDisconnect", (player) => {
      clearTalk(player);
    });
  },
};
