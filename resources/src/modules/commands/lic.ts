import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { LICENSE_ROWS } from "../auth/licenses";
import { getAccount, type Account } from "../auth/session";
import { registerCommand } from "./registry";

export const LICENSES_DIALOG_ID = 28;

const DIALOG_STYLE_MSGBOX = 0;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

registerCommand("lic", "Лицензии: посмотреть или показать по id", (player, args) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const rawId = args.trim();
  if (!rawId) {
    showLicenses(player, account);
    return;
  }

  const slot = Number(rawId);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /lic [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    showLicenses(player, account);
    return;
  }

  if (!getAccount(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  showLicenses(target, account);
  const shownTo = playerName(target);
  const verb = byGender(account.gender, "показал", "показала");
  player.sendClientMessage(Color.gray, `Вы ${verb} лицензии: ${shownTo}.`);
  target.sendClientMessage(Color.gray, `${account.name} ${verb} вам лицензии.`);
});

function licRow(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}

function showLicenses(viewer: Player, owner: Account): void {
  const body = LICENSE_ROWS.map((row) =>
    licRow(row.label, owner.licenses[row.key] ? "Есть" : "Нет")
  ).join("\n");

  try {
    Dialog.show(
      viewer,
      LICENSES_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Лицензии ${owner.name}`,
      body,
      "Закрыть",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Не удалось открыть лицензии.");
  }
}
