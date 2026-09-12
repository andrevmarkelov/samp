import { Color } from "../../shared/colors";
import { tryOccupyHospitalBed } from "../hospital";
import { registerCommand } from "./registry";

registerCommand("hospital", "Zanyat' koyku v bolnice", (player) => {
  tryOccupyHospitalBed(player);
});
