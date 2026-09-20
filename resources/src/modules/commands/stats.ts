import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatBirthDate } from "../auth/validation";
import { genderLabel } from "../auth/gender";
import { getAccount } from "../auth/session";
import { getMembership, resolvePlayerSkin } from "../org";
import { expForNextLevel } from "../payday/progress";
import { registerCommand } from "./registry";

const STATS_DIALOG_ID = 2;
const DIALOG_STYLE_MSGBOX = 0;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

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

  const membership = getMembership(account);
  const rank = membership
    ? `${membership.rank.title} (${membership.rank.id})`
    : "Net";
  const body = [
    statsRow("Imya", account.name),
    statsRow("Pol", genderLabel(account.gender)),
    statsRow("Uroven'", String(account.level)),
    statsRow("Opyt", `${account.exp}/${expForNextLevel(account.level)}`),
    statsRow("Zakonoposlushnost'", String(account.lawfulness)),
    statsRow("Skin", String(resolvePlayerSkin(account))),
    statsRow("Data rozhdeniya", formatBirthDate(account.birthDate)),
    statsRow("Pochta", account.email),
    statsRow("Den'gi", `$${account.money}`),
    statsRow("Bank", `$${account.bank}`),
    statsRow("Donat-schet", String(account.donate)),
    statsRow("Zdorov'e", String(health)),
    statsRow("Organizaciya", membership?.org.name ?? "Net"),
    statsRow("Dolzhnost'", rank),
  ].join("\n");

  try {
    Dialog.show(
      player,
      STATS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Statistika ${account.name}`,
      body,
      "Zakryt'",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' statistiku.");
  }
}

function statsRow(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}
