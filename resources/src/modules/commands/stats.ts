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

registerCommand("stats", "Статистика персонажа", (player) => {
  showStatsDialog(player);
});

export function showStatsDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
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
    : "Нет";
  const body = [
    statsRow("Имя", account.name),
    statsRow("Пол", genderLabel(account.gender)),
    statsRow("Уровень", String(account.level)),
    statsRow("Опыт", `${account.exp}/${expForNextLevel(account.level)}`),
    statsRow("Законопослушность", String(account.lawfulness)),
    statsRow("Скин", String(resolvePlayerSkin(account))),
    statsRow("Дата рождения", formatBirthDate(account.birthDate)),
    statsRow("Почта", account.email),
    statsRow("Деньги", `$${account.money}`),
    statsRow("Банк", `$${account.bank}`),
    statsRow("Донат-счёт", String(account.donate)),
    statsRow("Здоровье", String(health)),
    statsRow("Организация", membership?.org.name ?? "Нет"),
    statsRow("Должность", rank),
  ].join("\n");

  try {
    Dialog.show(
      player,
      STATS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Статистика ${account.name}`,
      body,
      "Закрыть",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть статистику.");
  }
}

function statsRow(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}
