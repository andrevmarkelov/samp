import { showHouseMenu } from "../houses/menu";
import { registerCommand } from "./registry";

registerCommand("hmenu", "Меню дома", (player) => {
  showHouseMenu(player);
});
