import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess, isAdminLoggedIn } from "./session";

type OnlineAdmin = {
  line: string;
  level: number;
  slot: number;
};

export function bindAdminsList(): void {
  registerCommand(
    "admins",
    "Spisok administratorov v igre",
    (player) => {
      if (!hasAdminAccess(player, 1)) {
        return;
      }

      const list: OnlineAdmin[] = [];

      omp.players.forEach((other) => {
        if (!isPlayerActive(other)) {
          return;
        }

        try {
          if (other.isNPC()) {
            return;
          }
        } catch {
          return;
        }

        const account = getAccount(other);
        if (!account || account.adminLevel < 1) {
          return;
        }

        const slot = playerId(other) ?? 0;
        const logged = isAdminLoggedIn(other) ? "da" : "net";
        list.push({
          level: account.adminLevel,
          slot,
          line: `${playerChatName(other)} | ${account.adminLevel} lvl | alogin: ${logged}`,
        });
      });

      list.sort((a, b) => b.level - a.level || a.slot - b.slot);

      player.sendClientMessage(Color.info, "Administratory v igre:");
      if (list.length === 0) {
        player.sendClientMessage(Color.white, "Nikogo net.");
        return;
      }

      for (const row of list) {
        player.sendClientMessage(Color.white, row.line);
      }
    },
    true
  );
}
