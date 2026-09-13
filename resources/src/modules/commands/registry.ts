import type { Player } from "@omp-node/core";
import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isAuthenticated } from "../auth/session";

export type CommandHandler = (player: Player, args: string) => void;

type Command = {
  description: string;
  handler: CommandHandler;
  hidden: boolean;
};

const commands = new Map<string, Command>();

export function registerCommand(
  name: string,
  description: string,
  handler: CommandHandler,
  hidden = false
): void {
  commands.set(name.toLowerCase(), { description, handler, hidden });
}

export function listCommands(): Array<{ name: string; description: string }> {
  return [...commands.entries()]
    .filter(([, cmd]) => !cmd.hidden)
    .map(([name, cmd]) => ({
      name,
      description: cmd.description,
    }));
}

export function handleCommand(player: Player, cmdtext: string): boolean {
  if (!isAuthenticated(player)) {
    return true;
  }

  const raw = cmdtext.startsWith("/") ? cmdtext.slice(1) : cmdtext;
  const space = raw.indexOf(" ");
  const name = (space === -1 ? raw : raw.slice(0, space)).trim().toLowerCase();
  const args = space === -1 ? "" : raw.slice(space + 1).trim();

  if (!name) {
    return true;
  }

  const cmd = commands.get(name);

  if (!cmd) {
    player.sendClientMessage(Color.error, `Neizvestnaya komanda: /${name}`);
    return true;
  }

  cmd.handler(player, args);
  return true;
}

export function bindCommandListener(): void {
  omp.on("playerCommandText", (player, cmdtext) => {
    return handleCommand(player, String(cmdtext ?? ""));
  });
}
