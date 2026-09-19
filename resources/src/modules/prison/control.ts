import { Dialog, omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { getAccount, isAuthenticated } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { LAW_ORG_IDS } from "../org/lspd";
import { getMembership } from "../org/membership";
import { PRISON_WORLD } from "../spawn/point";

export const PRISON_CMD_DIALOG_ID = 26;
export const PRISON_YARD_DIALOG_ID = 27;

const DIALOG_STYLE_LIST = 2;
const PLAYER_STATE_ONFOOT = 1;
const LABEL_HEIGHT = 0.25;
const PICKUP_LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const CMD_RADIUS = 2.5;
const DENY = "Otkryt' mogut sotrudniki LSPD, oblastnoy policii i FBI.";

const POINT = {
  x: -96.0945,
  y: 2434.6936,
  z: 1179.3195,
} as const;

const YARD_PICKUP = {
  x: -58.4486,
  y: 2435.0085,
  z: 1179.3195,
} as const;

let yardOpen = true;
let yardLabel: TextLabel | null = null;

export function isPrisonYardOpen(): boolean {
  return yardOpen;
}

function yardLabelText(): string {
  return yardOpen ? "Tyuremnyy dvor\nOtkryt" : "Tyuremnyy dvor\nZakryt";
}

function yardLabelColor(): number {
  return yardOpen ? Color.tryOk : Color.error;
}

function refreshYardLabel(): void {
  if (!yardLabel) {
    return;
  }

  try {
    yardLabel.updateText(yardLabelColor(), yardLabelText());
  } catch {
    // Лейбл уже уничтожен.
  }
}

export function bindPrisonControl(): void {
  new TextLabel(
    "Dlya upravleniya vvedite /pult.",
    Color.info,
    POINT.x,
    POINT.y,
    POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    PRISON_WORLD,
    false
  );

  yardLabel = new TextLabel(
    yardLabelText(),
    yardLabelColor(),
    YARD_PICKUP.x,
    YARD_PICKUP.y,
    YARD_PICKUP.z + PICKUP_LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    PRISON_WORLD,
    false
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (id !== PRISON_CMD_DIALOG_ID && id !== PRISON_YARD_DIALOG_ID) {
      return;
    }

    if (Number(response) === 0) {
      if (id === PRISON_YARD_DIALOG_ID && canUsePanel(player)) {
        showCmdMenu(player);
      }
      return;
    }

    if (!canUsePanel(player)) {
      return;
    }

    if (id === PRISON_CMD_DIALOG_ID) {
      handleCmdMenu(player, Number(listItem), String(inputText ?? ""));
      return;
    }

    handleYardMenu(player, Number(listItem), String(inputText ?? ""));
  });
}

registerCommand(
  "pult",
  "Upravlenie tyur'moy",
  (player) => {
    if (!isAuthenticated(player)) {
      return;
    }

    if (!isLawStaff(player, true)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        tell(player, Color.error, "Upravlenie dostupno tol'ko peshkom.");
        return;
      }
    } catch {
      return;
    }

    if (!atPanel(player)) {
      tell(player, Color.error, "Upravlenie dostupno tol'ko u pulta.");
      return;
    }

    showCmdMenu(player);
  },
  true
);

function handleCmdMenu(player: Player, listItem: number, inputText: string): void {
  const choice = pickChoice(listItem, inputText, ["dvor", "kamery"]);
  if (choice === 0) {
    showYardMenu(player);
    return;
  }

  if (choice === 1) {
    tell(player, Color.info, "Kamery poka v razrabotke.");
  }
}

function handleYardMenu(player: Player, listItem: number, inputText: string): void {
  const choice = pickChoice(listItem, inputText, ["otkryt'", "zakryt'"]);
  if (choice === 0) {
    if (yardOpen) {
      tell(player, Color.info, "Dvor uzhe otkryt.");
      return;
    }

    yardOpen = true;
    refreshYardLabel();
    tell(player, Color.info, "Dvor otkryt.");
    return;
  }

  if (choice === 1) {
    if (!yardOpen) {
      tell(player, Color.info, "Dvor uzhe zakryt.");
      return;
    }

    yardOpen = false;
    refreshYardLabel();
    tell(player, Color.info, "Dvor zakryt.");
  }
}

function showCmdMenu(player: Player): void {
  try {
    Dialog.show(
      player,
      PRISON_CMD_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Upravlenie",
      "1. Dvor\n2. Kamery",
      "Vybrat'",
      "Zakryt'"
    );
  } catch {
    tell(player, Color.error, "Ne udalos' otkryt' menyu.");
  }
}

function showYardMenu(player: Player): void {
  try {
    Dialog.show(
      player,
      PRISON_YARD_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Dvor",
      "1. Otkryt'\n2. Zakryt'",
      "Vybrat'",
      "Nazad"
    );
  } catch {
    tell(player, Color.error, "Ne udalos' otkryt' menyu.");
  }
}

function canUsePanel(player: Player): boolean {
  return isLawStaff(player, false) && atPanel(player);
}

function isLawStaff(player: Player, tellDeny: boolean): boolean {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  if (account.hospitalized) {
    if (tellDeny) {
      tell(player, Color.error, "Snachala proydite lechenie v bolnice.");
    }
    return false;
  }

  const membership = getMembership(account);
  const orgId = membership?.org.id;
  if (orgId === undefined || !(LAW_ORG_IDS as readonly number[]).includes(orgId)) {
    if (tellDeny) {
      tell(player, Color.error, DENY);
    }
    return false;
  }

  return true;
}

function atPanel(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== PRISON_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return distance3d(pos.x, pos.y, pos.z, POINT.x, POINT.y, POINT.z) <= CMD_RADIUS;
  } catch {
    return false;
  }
}

function pickChoice(listItem: number, inputText: string, labels: readonly string[]): number {
  const raw = inputText.replace(/^\d+\.\s*/, "").trim().toLowerCase();
  const byLabel = labels.findIndex((label) => label === raw);
  if (byLabel >= 0) {
    return byLabel;
  }

  return Number.isInteger(listItem) ? listItem : -1;
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Игрок уже вышел.
  }
}

function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}
