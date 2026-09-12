import { Color } from "../../shared/colors";
import { listCommands, registerCommand } from "./registry";

registerCommand("help", "Spisok komand", (player) => {
  player.sendClientMessage(Color.info, "Komandy:");

  for (const cmd of listCommands()) {
    player.sendClientMessage(Color.white, `/${cmd.name} — ${cmd.description}`);
  }
});
