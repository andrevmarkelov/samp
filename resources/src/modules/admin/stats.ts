import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { showStatsDialog } from "../commands/stats";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 1;

export function bindAdminStats(): void {
  registerCommand(
    "stats",
    "Статистика игрока",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const raw = args.trim();
      if (!raw || !/^\d+$/.test(raw)) {
        player.sendClientMessage(Color.error, "Использование: /stats [id]");
        return;
      }

      const slot = Number(raw);
      if (!Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Использование: /stats [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      const targetAccount = getAccount(target);
      if (!targetAccount) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (targetAccount.adminLevel >= 1) {
        player.sendClientMessage(
          Color.error,
          "Нельзя просматривать статистику администратора."
        );
        return;
      }

      showStatsDialog(player, target);
    },
    true
  );
}

function findTarget(slot: number): Player | null {
  try {
    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      return null;
    }

    if (target.isNPC()) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}
