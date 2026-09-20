import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { byGender, genderLabel } from "../auth/gender";
import { getAccount, type Account } from "../auth/session";
import { ageFromBirthDate, formatBirthDate } from "../auth/validation";
import { getMembership } from "../org";
import { registerCommand } from "./registry";

const PASSPORT_DIALOG_ID = 3;
const DIALOG_STYLE_MSGBOX = 0;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

registerCommand("pass", "Паспорт: посмотреть или показать по id", (player, args) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(
      Color.error,
      "У вас нет паспорта. Обратитесь в мэрию."
    );
    return;
  }

  const rawId = args.trim();
  if (!rawId) {
    showPassport(player, account);
    return;
  }

  const slot = Number(rawId);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /pass [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    showPassport(player, account);
    return;
  }

  if (!isAuthenticatedTarget(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  showPassport(target, account);
  const shownTo = playerName(target);
  const verb = byGender(account.gender, "показал", "показала");
  player.sendClientMessage(Color.gray, `Вы ${verb} паспорт: ${shownTo}.`);
  target.sendClientMessage(Color.gray, `${account.name} ${verb} вам паспорт.`);
});

function isAuthenticatedTarget(player: Player): boolean {
  return getAccount(player) !== null;
}

function passRow(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}

function showPassport(viewer: Player, owner: Account): void {
  const membership = getMembership(owner);
  const body = [
    passRow("Имя", owner.name),
    passRow("Проживание в стране (лет)", String(ageFromBirthDate(owner.birthDate))),
    passRow("Пол", genderLabel(owner.gender)),
    passRow("Дата рождения", formatBirthDate(owner.birthDate)),
    passRow("Организация", membership?.org.name ?? "Нет"),
    passRow("Должность", membership?.rank.title ?? "Нет"),
    passRow("Законопослушность", String(owner.lawfulness)),
  ].join("\n");

  try {
    Dialog.show(
      viewer,
      PASSPORT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Паспорт ${owner.name}`,
      body,
      "Закрыть",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Не удалось открыть паспорт.");
  }
}
