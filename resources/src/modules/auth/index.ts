import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import type { GameModule } from "../types";
import { writeSpawnInfo } from "../spawn/point";
import { AUTH_DIALOG_ID } from "./dialogs";
import { beginAuth, endAuth, handleAuthDialog, handleSkinPickerAction, holdAtAuth } from "./flow";
import { bindSkinPicker } from "./skin-picker";
import { ensureUsersTable } from "./repository";
import { getAccount, isAuthenticated } from "./session";
import { resolvePlayerSkin } from "../org";

export { isAuthenticated, getAccount, getGender } from "./session";
export type { Gender } from "./gender";
export { genderLabel } from "./gender";

const PLAYER_STATE_WASTED = 7;

export const authModule: GameModule = {
  name: "auth",
  async start() {
    try {
      await ensureUsersTable();
      omp.log(`[${SERVER_TAG}] таблица users готова`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] не удалось подготовить users: ${message}`);
    }

    omp.on("playerConnect", (player) => {
      endAuth(player);
      try {
        player.toggleSpectating(true);
      } catch {
        // Слот ещё не готов.
      }

      setTimeout(() => {
        if (isPlayerActive(player)) {
          void beginAuth(player);
        }
      }, 500);
    });

    omp.on("playerDisconnect", (player) => {
      endAuth(player);
    });

    omp.on("playerRequestClass", (player) => {
      if (!isAuthenticated(player)) {
        holdAtAuth(player);
        return false;
      }

      const account = getAccount(player);
      if (!account) {
        return false;
      }

      try {
        const skin = resolvePlayerSkin(account);
        if (player.isSpawned() && player.getState() !== PLAYER_STATE_WASTED) {
          const pos = player.getPos();
          writeSpawnInfo(player, skin, {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            angle: player.getFacingAngle(),
            interior: player.getInterior(),
            world: player.getVirtualWorld(),
          });
        }

        player.setSkin(skin);
        player.spawn();
      } catch {
        // Спавн уже идёт.
      }

      return false;
    });

    omp.on("playerRequestSpawn", (player) => {
      return isAuthenticated(player);
    });

    omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
      if (Number(dialogId) !== AUTH_DIALOG_ID) {
        return;
      }

      void handleAuthDialog(
        player,
        Number(response),
        Number(listItem),
        String(inputText ?? "")
      );
    });

    bindSkinPicker(handleSkinPickerAction);
  },
};
