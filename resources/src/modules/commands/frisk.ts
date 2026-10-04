import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount } from "../auth/session";
import { resolveLawNearbyTarget } from "./law-target";
import { registerCommand } from "./registry";

export const FRISK_DIALOG_ID = 140;

const DIALOG_STYLE_MSGBOX = 0;
const LABEL = "{FFFFFF}";
const VALUE = "{33CCFF}";
const EMPTY = "{AAAAAA}";

registerCommand("frisk", "Обыскать игрока (полиция / FBI)", (player, args) => {
  const resolved = resolveLawNearbyTarget(
    player,
    args,
    "Использование: /frisk [id]"
  );
  if (!resolved.ok) {
    return;
  }

  const { officer, target } = resolved;
  const account = getAccount(target);
  if (!account) {
    officer.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!showFriskResult(officer, account.name, account)) {
    return;
  }

  const frisked = byGender(
    getAccount(officer)?.gender ?? null,
    "обыскал",
    "обыскала"
  );
  sendNearby(
    officer,
    CHAT_RADIUS,
    Color.action,
    `${playerName(officer)} тщательно ${frisked} ${playerName(target)}.`
  );

  try {
    target.sendClientMessage(Color.gray, `${playerName(officer)} обыскивает вас.`);
  } catch {
    // Уже вышел.
  }
});

function showFriskResult(
  viewer: Player,
  ownerName: string,
  account: {
    phone: string | null;
    metal: number;
    drugs: number;
    ammo: number;
  }
): boolean {
  const body = [
    row("Телефон", account.phone ? account.phone : "Нет", !account.phone),
    row("Металл", `${account.metal} шт.`, account.metal <= 0),
    row("Наркотики", `${account.drugs} шт.`, account.drugs <= 0),
    row("Патроны", `${account.ammo} шт.`, account.ammo <= 0),
  ].join("\n");

  try {
    Dialog.show(
      viewer,
      FRISK_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `{FFCC00}Обыск: ${ownerName}`,
      body,
      "Закрыть",
      ""
    );
    return true;
  } catch {
    viewer.sendClientMessage(Color.error, "Не удалось открыть результат обыска.");
    return false;
  }
}

function row(label: string, value: string, empty: boolean): string {
  return `${LABEL}${label}:\t\t${empty ? EMPTY : VALUE}${value}`;
}
