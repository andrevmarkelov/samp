import { tryOpenHouseStore } from "../houses/store";
import { registerCommand } from "./registry";

registerCommand("use", "Открыть шкаф в своём доме", (player) => {
  tryOpenHouseStore(player);
});
