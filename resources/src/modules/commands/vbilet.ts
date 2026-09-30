import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { saveUserMilitaryId } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount, type Account } from "../auth/session";
import { ORG_ARMY_ID, getMembership } from "../org";
import { registerCommand } from "./registry";

export const VBILET_DIALOG_ID = 67;

const DIALOG_STYLE_MSGBOX = 0;
const ISSUE_MIN_RANK = 8;
const TITLE = "{FFCC00}";
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";

registerCommand("vbilet", "Военный билет: посмотреть или показать по id", (player, args) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войдите в аккаунт.");
    return;
  }

  if (!account.militaryId) {
    player.sendClientMessage(Color.error, "У вас нет военного билета.");
    return;
  }

  const rawId = args.trim();
  if (!rawId) {
    showMilitaryId(player, account);
    return;
  }

  const slot = Number(rawId);
  if (!Number.isInteger(slot) || slot < 0) {
    player.sendClientMessage(Color.error, "Использование: /vbilet [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    showMilitaryId(player, account);
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  showMilitaryId(target, account);
  const verb = byGender(account.gender, "показал", "показала");
  player.sendClientMessage(Color.gray, `Вы ${verb} военный билет: ${playerName(target)}.`);
  target.sendClientMessage(Color.gray, `${account.name} ${verb} вам военный билет.`);
});

registerCommand(
  "givevbilet",
  "Выдать военный билет (Армия, ранг 8+)",
  (player, args) => {
    const account = getAccount(player);
    const membership = account ? getMembership(account) : null;
    if (
      !account ||
      !membership ||
      membership.org.id !== ORG_ARMY_ID ||
      membership.rank.id < ISSUE_MIN_RANK
    ) {
      player.sendClientMessage(
        Color.error,
        "Выдавать военный билет может сотрудник Армии с ранга 8 и выше."
      );
      return;
    }

    const slot = Number(args.trim());
    if (!Number.isInteger(slot) || slot < 0) {
      player.sendClientMessage(Color.error, "Использование: /givevbilet [id]");
      return;
    }

    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (playerId(target) === playerId(player)) {
      player.sendClientMessage(Color.error, "Нельзя выдать военный билет себе.");
      return;
    }

    const targetAccount = getAccount(target);
    if (!targetAccount) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (targetAccount.militaryId) {
      player.sendClientMessage(Color.error, "У игрока уже есть военный билет.");
      return;
    }

    patchAccount(target, { militaryId: true });
    void saveUserMilitaryId(targetAccount.id, true).catch(() => {
      // Кэш уже обновлён.
    });

    player.sendClientMessage(
      Color.info,
      `Вы выдали военный билет игроку ${playerName(target)}.`
    );
    target.sendClientMessage(
      Color.info,
      `${playerName(player)} выдал вам военный билет. Посмотреть: /vbilet`
    );
  }
);

function showMilitaryId(viewer: Player, owner: Account): void {
  const served = byGender(owner.gender, "Отслужил", "Отслужила");
  const body = [
    row("Имя", owner.name),
    row("Статус", "Военный билет получен"),
    row("Служба", served),
  ].join("\n");

  try {
    Dialog.show(
      viewer,
      VBILET_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Военный билет ${owner.name}`,
      body,
      "Закрыть",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Не удалось открыть военный билет.");
  }
}

function row(label: string, value: string): string {
  return `${LABEL}${label}:\t\t${VALUE}${value}`;
}
