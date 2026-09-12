import { showGpsMenu } from "../gps";
import { registerCommand } from "./registry";

registerCommand("gps", "Marshrut ili otklyuchit' GPS", (player) => {
  showGpsMenu(player);
});
