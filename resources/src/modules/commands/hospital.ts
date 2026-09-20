import { Color } from "../../shared/colors";
import { tryOccupyHospitalBed } from "../hospital";
import { registerCommand } from "./registry";

registerCommand("hospital", "Занять койку в больнице", (player) => {
  tryOccupyHospitalBed(player);
});
