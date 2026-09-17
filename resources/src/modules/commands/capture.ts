import { tryStartCapture } from "../zones/capture";
import { registerCommand } from "./registry";

registerCommand("capture", "Zahvat territorii bandy", (player) => {
  tryStartCapture(player);
});
