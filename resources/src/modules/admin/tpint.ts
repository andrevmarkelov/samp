import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { playerId } from "../../shared/player";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt } from "../spawn/point";
import { registerCommand } from "../commands/registry";
import { ADMIN_INTERIORS, type AdminInterior } from "./interiors";
import { hasAdminAccess } from "./session";

export const TPINT_DIALOG_ID = 41;

const MIN_LEVEL = 4;
const DIALOG_STYLE_LIST = 2;
const PAGE_SIZE = 16;
const BACK_LABEL = "<<< Nazad";
const NEXT_LABEL = ">>> Dalee";
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

const pageByPlayer = new Map<number, number>();

function pageCount(): number {
  return Math.max(1, Math.ceil(ADMIN_INTERIORS.length / PAGE_SIZE));
}

function clampPage(page: number): number {
  return Math.min(pageCount() - 1, Math.max(0, page));
}

function canTeleport(player: Player): boolean {
  try {
    if (!player.isSpawned()) {
      return false;
    }

    const state = player.getState();
    return state !== PLAYER_STATE_WASTED && state !== PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function pageLines(page: number): string[] {
  const start = page * PAGE_SIZE;
  const items = ADMIN_INTERIORS.slice(start, start + PAGE_SIZE);
  const lines: string[] = [];
  if (page > 0) {
    lines.push(BACK_LABEL);
  }

  for (let i = 0; i < items.length; i++) {
    const spot = items[i];
    if (!spot) {
      continue;
    }

    lines.push(`${start + i + 1}. ${spot.name}`);
  }

  if (page + 1 < pageCount()) {
    lines.push(NEXT_LABEL);
  }

  return lines;
}

function showList(player: Player, page: number): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const safePage = clampPage(page);
  pageByPlayer.set(id, safePage);
  const lines = pageLines(safePage);

  try {
    Dialog.show(
      player,
      TPINT_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Interiery (${safePage + 1}/${pageCount()})`,
      lines.join("\n"),
      "Vybrat'",
      "Zakryt'"
    );
  } catch {
    pageByPlayer.delete(id);
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' spisok interierov.");
  }
}

function pickFromPage(page: number, listItem: number, inputText: string): number | "back" | "next" | null {
  const lines = pageLines(page);
  const raw = inputText.trim().toLowerCase();
  if (raw === BACK_LABEL.toLowerCase() || (lines[listItem] === BACK_LABEL && listItem === 0 && page > 0)) {
    return "back";
  }

  if (
    raw === NEXT_LABEL.toLowerCase() ||
    (lines[listItem] === NEXT_LABEL && listItem === lines.length - 1 && page + 1 < pageCount())
  ) {
    return "next";
  }

  const byLabel = lines[listItem];
  if (byLabel && byLabel !== BACK_LABEL && byLabel !== NEXT_LABEL) {
    const match = byLabel.match(/^(\d+)\./);
    const index = match ? Number(match[1]) - 1 : NaN;
    if (Number.isInteger(index) && ADMIN_INTERIORS[index]) {
      return index;
    }
  }

  const typed = Number(raw.replace(/\D/g, ""));
  if (Number.isInteger(typed) && typed >= 1 && typed <= ADMIN_INTERIORS.length) {
    return typed - 1;
  }

  return null;
}

function teleportToInterior(player: Player, spot: AdminInterior): boolean {
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }

  try {
    placeAt(player, {
      x: spot.x,
      y: spot.y,
      z: spot.z,
      angle: 0,
      interior: spot.interior,
      world: STREET_WORLD,
    });
    refreshStreamForPlayer(player);
    return true;
  } catch {
    return false;
  }
}

function goToSpot(player: Player, spot: AdminInterior): void {
  if (!canTeleport(player)) {
    player.sendClientMessage(Color.error, "Seychas nel'zya teleportirovat'sya.");
    return;
  }

  if (!teleportToInterior(player, spot)) {
    player.sendClientMessage(Color.error, "Ne udalos' teleportirovat'sya.");
    return;
  }

  player.sendClientMessage(
    Color.info,
    `Teleport: ${spot.name} (interior ${spot.interior}).`
  );
}

function clearPage(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pageByPlayer.delete(id);
  }
}

export function bindAdminTpint(): void {
  registerCommand(
    "tpint",
    "Teleport v interier",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const raw = args.trim();
      if (!raw) {
        showList(player, 0);
        return;
      }

      const index = Number(raw);
      if (!Number.isInteger(index) || index < 1 || index > ADMIN_INTERIORS.length) {
        player.sendClientMessage(
          Color.error,
          `Ispol'zovanie: /tpint [1-${ADMIN_INTERIORS.length}]`
        );
        return;
      }

      const spot = ADMIN_INTERIORS[index - 1];
      if (!spot) {
        player.sendClientMessage(
          Color.error,
          `Ispol'zovanie: /tpint [1-${ADMIN_INTERIORS.length}]`
        );
        return;
      }

      goToSpot(player, spot);
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== TPINT_DIALOG_ID) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    const page = pageByPlayer.get(id) ?? 0;
    if (Number(response) === 0) {
      pageByPlayer.delete(id);
      return;
    }

    if (!hasAdminAccess(player, MIN_LEVEL)) {
      pageByPlayer.delete(id);
      return;
    }

    const picked = pickFromPage(page, Number(listItem), String(inputText ?? ""));
    if (picked === "back") {
      showList(player, page - 1);
      return;
    }

    if (picked === "next") {
      showList(player, page + 1);
      return;
    }

    pageByPlayer.delete(id);
    if (picked === null) {
      showList(player, page);
      return;
    }

    const spot = ADMIN_INTERIORS[picked];
    if (!spot) {
      showList(player, page);
      return;
    }

    goToSpot(player, spot);
  });

  omp.on("playerConnect", (player) => {
    clearPage(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPage(player);
  });
}
