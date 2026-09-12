import { Dialog } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatBirthDate } from "../auth/validation";
import { genderLabel } from "../auth/gender";
import { getAccount } from "../auth/session";
import { registerCommand } from "./registry";

const STATS_DIALOG_ID = 2;
const DIALOG_STYLE_MSGBOX = 0;

registerCommand("stats", "Statistika personazha", (player) => {
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
    `Имя: ${account.name}`,
    `Пол: ${genderLabel(account.gender)}`,
    `Уровень: ${account.level}`,
    `Скин: ${account.skin}`,
    `Дата рождения: ${formatBirthDate(account.birthDate)}`,
    `Почта: ${account.email}`,
    `Деньги: $${account.money}`,
    `Донат-счёт: ${account.donate}`,
    `Здоровье: ${health}`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      STATS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Статистика",
      body,
      "Закрыть",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' statistiku.");
  }
});
