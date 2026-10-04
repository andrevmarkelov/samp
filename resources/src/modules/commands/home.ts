import { showHouseMenu } from "../houses/menu";
import { registerCommand } from "./registry";

registerCommand("home", "Меню дома", (player) => {
  showHouseMenu(player);
});
