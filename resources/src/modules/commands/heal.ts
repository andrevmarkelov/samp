import { tryHealInHouse } from "../houses/heal";
import { registerCommand } from "./registry";

registerCommand("heal", "Лечение в доме с аптечкой", (player) => {
  tryHealInHouse(player);
});
