import { omp } from "@omp-node/core";
import { Color, chatColorTag } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  CHAT_RADIUS,
  clipClientMessage,
  sanitizeChatText,
  sendNearby,
} from "../../shared/nearby";
import { playerChatName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount, isAuthenticated } from "../auth/session";
import { isMasked, MASK_COLOR } from "../mask";
import { getMembership, resolveChatColor } from "../org";
import type { GameModule } from "../types";
import { notifyIfMuted, clearMuteWatch, watchMute } from "./mute";
import { clearTalk, playLocalSpeech } from "./talk";

function nearbyChatLine(
  playerName: string,
  text: string,
  nameColor: number | null,
  verb: string
): string {
  if (nameColor === null) {
    return clipClientMessage(`${playerName} ${verb}: ${text}`);
  }

  return clipClientMessage(
    `${chatColorTag(nameColor)}${playerName}${chatColorTag(Color.white)} ${verb}: ${text}`
  );
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
      const masked = isMasked(player);
      const inOrg = account ? getMembership(account) : null;
      const verb = byGender(account?.gender ?? null, "сказал", "сказала");
      const nameColor = masked
        ? MASK_COLOR
        : account && inOrg
          ? resolveChatColor(account)
          : null;
      sendNearby(
        player,
        CHAT_RADIUS,
        masked || inOrg ? Color.white : Color.chat,
        nearbyChatLine(playerChatName(player), text, nameColor, verb)
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
