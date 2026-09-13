import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatBirthDate } from "../auth/validation";
import { genderLabel } from "../auth/gender";
import { getAccount } from "../auth/session";
import { orgStatsLines, resolvePlayerSkin } from "../org";
import { expForNextLevel } from "../payday/progress";
import { registerCommand } from "./registry";

const STATS_DIALOG_ID = 2;
const DIALOG_STYLE_MSGBOX = 0;

registerCommand("stats", "Statistika personazha", (player) => {
  showStatsDialog(player);
});

export function showStatsDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Snachala voydi v akkaunt.");
    return;
  }

  let health = Math.round(account.health);
  try {
    const live = player.getHealth();
    if (live > 0) {
      health = Math.round(live);
    }
  } catch {
    // Статы мира недоступны — покажем данные аккаунта.
  }

  const body = [
    `Imya: ${account.name}`,
    `Pol: ${genderLabel(account.gender)}`,
    `Uroven': ${account.level}`,
    `Opyt: ${account.exp}/${expForNextLevel(account.level)}`,
    `Skin: ${resolvePlayerSkin(account)}`,
    `Data rozhdeniya: ${formatBirthDate(account.birthDate)}`,
    `Pochta: ${account.email}`,
    `Den'gi: $${account.money}`,
    `Donat-schet: ${account.donate}`,
    `Zdorov'e: ${health}`,
    ...orgStatsLines(account),
  ].join("\n");

  try {
    Dialog.show(
      player,
      STATS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Statistika",
      body,
      "Zakryt'",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' statistiku.");
  }
}
