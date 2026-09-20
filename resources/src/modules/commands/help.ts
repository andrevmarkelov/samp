import { Color } from "../../shared/colors";
import { listCommands, registerCommand } from "./registry";

registerCommand("help", "Список команд", (player) => {
  player.sendClientMessage(Color.info, "Команды:");

  for (const cmd of listCommands()) {
    player.sendClientMessage(Color.white, `/${cmd.name} — ${cmd.description}`);
  }
});
