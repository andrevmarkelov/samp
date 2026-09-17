import { omp } from "@omp-node/core";
import { Color, chatColorTag } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  CHAT_RADIUS,
  CLIENT_MESSAGE_MAX,
  sanitizeChatText,
  sendNearby,
} from "../../shared/nearby";
import { playerChatName } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { getMembership, resolveChatColor } from "../org";
import type { GameModule } from "../types";
import { notifyIfMuted, clearMuteWatch, watchMute } from "./mute";
import { clearTalk, playLocalSpeech } from "./talk";

function nearbyChatLine(playerName: string, text: string, nameColor: number | null): string {
  if (nameColor === null) {
    return `${playerName}: ${text}`;
  }

  const prefix = `${chatColorTag(nameColor)}${playerName}: ${chatColorTag(Color.white)}`;
  return prefix + text.slice(0, Math.max(0, CLIENT_MESSAGE_MAX - prefix.length));
}

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
      const inOrg = account ? getMembership(account) : null;
      sendNearby(
        player,
        CHAT_RADIUS,
        inOrg ? Color.white : Color.chat,
        nearbyChatLine(
          playerChatName(player),
          text,
          account && inOrg ? resolveChatColor(account) : null
        )
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
