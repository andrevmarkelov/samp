import { showSellHouseDialog } from "../houses/sell";
import { registerCommand } from "./registry";

registerCommand("sellhouse", "Продать дом государству", (player) => {
  showSellHouseDialog(player);
});
