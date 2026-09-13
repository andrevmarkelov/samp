import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, kickSamePlayer } from "../../shared/player";
import { DEFAULT_SPAWN, STREET_WORLD } from "../spawn/point";
import { GENDER_LIST_FEMALE, GENDER_LIST_MALE, type Gender } from "./gender";
import { RULES_TITLE, SERVER_RULES } from "./rules";
import { isAuthenticated } from "./session";
import { skinListBody } from "./skins";

export const AUTH_DIALOG_ID = 1;

export const DialogStyle = {
  msgbox: 0,
  input: 1,
  list: 2,
  password: 3,
} as const;

export function showAuthDialog(
  player: Player,
  style: number,
  title: string,
  body: string,
  button1: string,
  button2: string
): void {
  try {
    Dialog.show(player, AUTH_DIALOG_ID, style, title, body, button1, button2);
  } catch {
    // Игрок уже вышел.
  }
}

export function prepareAuthView(player: Player): void {
  player.setInterior(0);
  player.setVirtualWorld(STREET_WORLD);
  player.setPos(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z);
  player.toggleSpectating(true);
  player.setCameraPos(1779.37, -1932.56, 22.0);
  player.setCameraLookAt(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z, 2);
}

export function refreshAuthViewSoon(player: Player): void {
  for (const delay of [80, 400]) {
    setTimeout(() => {
      if (!isPlayerActive(player) || isAuthenticated(player)) {
        return;
      }

      try {
        prepareAuthView(player);
      } catch {
        // Слот ещё не готов.
      }
    }, delay);
  }
}

export function kickLater(player: Player, reason: string): void {
  player.sendClientMessage(Color.error, reason);
  kickSamePlayer(player);
}

export function showRulesDialog(player: Player): void {
  showAuthDialog(
    player,
    DialogStyle.msgbox,
    RULES_TITLE,
    SERVER_RULES,
    "Prinimayu",
    "Otkazat'sya"
  );
}

export function showLoginDialog(player: Player, name: string, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Avtorizaciya",
    `${prefix}Nik ${name} uzhe zaregistrirovan.\nVvedi parol':`,
    "Voyti",
    "Vykhod"
  );
}

export function showEmailDialog(player: Player, name: string, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Registraciya",
    `${prefix}Nik ${name} svoboden.\nVvedi pochtu:`,
    "Dalee",
    "Nazad"
  );
}

export function showPasswordDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Registraciya",
    `${prefix}Pridumay parol' (ot 6 simvolov):`,
    "Dalee",
    "Nazad"
  );
}

export function showPasswordConfirmDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Registraciya",
    `${prefix}Povtori parol':`,
    "Dalee",
    "Nazad"
  );
}

export function showBirthDateDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Registraciya",
    `${prefix}Data rozhdeniya (DD.MM.YYYY):\nNaprimer 15.04.1998`,
    "Dalee",
    "Nazad"
  );
}

export function showGenderDialog(player: Player): void {
  showAuthDialog(
    player,
    DialogStyle.list,
    "Pol personazha",
    `${GENDER_LIST_MALE}\n${GENDER_LIST_FEMALE}`,
    "Vybrat'",
    "Nazad"
  );
}

export function showSkinDialog(player: Player, gender: Gender): void {
  showAuthDialog(
    player,
    DialogStyle.list,
    "Vybor skina",
    skinListBody(gender),
    "Vybrat'",
    "Nazad"
  );
}

export function showRegisterConfirmDialog(player: Player, body: string): void {
  showAuthDialog(
    player,
    DialogStyle.msgbox,
    "Podtverzhdenie",
    body,
    "Gotovo",
    "Nazad"
  );
}
