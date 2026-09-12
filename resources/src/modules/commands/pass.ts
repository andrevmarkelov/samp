import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { WHISPER_RADIUS } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { registerCommand } from "./registry";

const PASSPORT_DIALOG_ID = 3;
const DIALOG_STYLE_MSGBOX = 0;

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
    showPassport(player, account.name, account.level);
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
    showPassport(player, account.name, account.level);
    return;
  }

  if (!isAuthenticatedTarget(target)) {
    player.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  if (!samePlaceNearby(player, target)) {
    player.sendClientMessage(Color.error, "Igrok slishkom daleko.");
    return;
  }

  showPassport(target, account.name, account.level);
  const shownTo = playerName(target);
  player.sendClientMessage(Color.gray, `Vy pokazali pasport: ${shownTo}.`);
  target.sendClientMessage(
    Color.gray,
    `${account.name} pokazal vam pasport.`
  );
});

function isAuthenticatedTarget(player: Player): boolean {
  return getAccount(player) !== null;
}

function samePlaceNearby(source: Player, other: Player): boolean {
  try {
    if (source.getVirtualWorld() !== other.getVirtualWorld()) {
      return false;
    }

    if (source.getInterior() !== other.getInterior()) {
      return false;
    }

    const pos = source.getPos();
    return other.getDistanceFromPoint(pos.x, pos.y, pos.z) <= WHISPER_RADIUS;
  } catch {
    return false;
  }
}

function showPassport(viewer: Player, name: string, level: number): void {
  const body = [`Imya: ${name}`, `Uroven': ${level}`].join("\n");

  try {
    Dialog.show(
      viewer,
      PASSPORT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Pasport",
      body,
      "Zakryt'",
      ""
    );
  } catch {
    viewer.sendClientMessage(Color.error, "Ne udalos' otkryt' pasport.");
  }
}
