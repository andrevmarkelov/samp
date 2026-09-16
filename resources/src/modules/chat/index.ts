import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, sanitizeChatText, sendNearby } from "../../shared/nearby";
import { playerChatName } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { resolveChatColor } from "../org";
import type { GameModule } from "../types";
import { notifyIfMuted, clearMuteWatch, watchMute } from "./mute";
import { clearTalk, playLocalSpeech } from "./talk";

export const chatModule: GameModule = {
  name: "chat",
  start() {
    omp.on("playerText", (player, raw) => {
      if (!isAuthenticated(player)) {
        return false;
      }

      const text = sanitizeChatText(String(raw ?? "").trim()).slice(0, CHAT_MAX_LENGTH);
      if (!text) {
        return false;
      }

      if (notifyIfMuted(player, { bubble: true })) {
        return false;
      }

      const account = getAccount(player);
      sendNearby(
        player,
        CHAT_RADIUS,
        account ? resolveChatColor(account) : Color.chat,
        `${playerChatName(player)}: ${text}`
      );
      playLocalSpeech(player, text);
      return false;
    });

    omp.on("playerSpawn", (player) => {
      if (isAuthenticated(player)) {
        watchMute(player);
      }
    });

    omp.on("playerDisconnect", (player) => {
      clearTalk(player);
      clearMuteWatch(player);
    });
  },
};
