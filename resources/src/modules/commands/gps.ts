import { showGpsMenu } from "../gps";
import { registerCommand } from "./registry";

registerCommand("gps", "Маршрут или отключить GPS", (player) => {
  showGpsMenu(player);
});
