import { Color } from "../../shared/colors";
import { getAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { ADMIN_COMMANDS_BY_LEVEL, MAX_ADMIN_LEVEL } from "./catalog";
import { hasAdminAccess } from "./session";

export function bindAdminHelp(): void {
  registerCommand(
    "ahelp",
    "Список админ-команд",
    (player) => {
      if (!hasAdminAccess(player, 1)) {
        return;
      }

      const account = getAccount(player);
      const level = Math.min(MAX_ADMIN_LEVEL, account?.adminLevel ?? 1);

      player.sendClientMessage(Color.info, "Доступные команды:");
      for (let n = 1; n <= level; n += 1) {
        const cmds = ADMIN_COMMANDS_BY_LEVEL[n] ?? [];
        const suffix = cmds.length > 0 ? ` ${cmds.join(" ")}` : "";
        player.sendClientMessage(Color.white, `${n} уровень:${suffix}`);
      }
    },
    true
  );
}
