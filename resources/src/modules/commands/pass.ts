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

registerCommand("pass", "Pasport: posmotret' ili pokazat' po id", (player, args) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Snachala voydi v akkaunt.");
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(
      Color.error,
      "U vas net pasporta. Obratites' v meriyu."
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
    player.sendClientMessage(Color.error, "Ispol'zovanie: /pass [id]");
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    player.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  if (playerId(target) === playerId(player)) {
    showPassport(player, account);
    return;
  }

  if (!isAuthenticatedTarget(target)) {
    player.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Igrok slishkom daleko.");
    return;
  }

  showPassport(target, account);
  const shownTo = playerName(target);
  const verb = byGender(account.gender, "pokazal", "pokazala");
  player.sendClientMessage(Color.gray, `Vy ${verb} pasport: ${shownTo}.`);
  target.sendClientMessage(Color.gray, `${account.name} ${verb} vam pasport.`);
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
    passRow("Imya", owner.name),
    passRow("Prozhivanie v strane (let)", String(ageFromBirthDate(owner.birthDate))),
    passRow("Pol", genderLabel(owner.gender)),
    passRow("Data rozhdeniya", formatBirthDate(owner.birthDate)),
    passRow("Organizaciya", membership?.org.name ?? "Net"),
    passRow("Dolzhnost'", membership?.rank.title ?? "Net"),
    passRow("Zakonoposlushnost'", String(owner.lawfulness)),
  ].join("\n");

  try {
    Dialog.show(
      viewer,
      PASSPORT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Pasport ${owner.name}`,
      body,
      "Zakryt'",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Ne udalos' otkryt' pasport.");
  }
}
