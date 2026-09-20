import { tryStartCapture } from "../zones/capture";
import { registerCommand } from "./registry";

registerCommand("capture", "Захват территории банды", (player) => {
  tryStartCapture(player);
});
