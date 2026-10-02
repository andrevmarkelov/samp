import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { playerId } from "../../shared/player";
import { listBusinesses, getBusiness, type BusinessRecord } from "../businesses/repository";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt } from "../spawn/point";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

export const TPBIZ_DIALOG_ID = 69;

const MIN_LEVEL = 4;
const DIALOG_STYLE_LIST = 2;
const PAGE_SIZE = 16;
const BACK_LABEL = "<<< Назад";
const NEXT_LABEL = ">>> Далее";
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

const pageByPlayer = new Map<number, number>();

function businesses(): readonly BusinessRecord[] {
  return listBusinesses();
}

function pageCount(): number {
  return Math.max(1, Math.ceil(businesses().length / PAGE_SIZE));
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
  const all = businesses();
  const start = page * PAGE_SIZE;
  const items = all.slice(start, start + PAGE_SIZE);
  const lines: string[] = [];

  if (page > 0) {
    lines.push(BACK_LABEL);
  }

  for (const business of items) {
    lines.push(`${business.id}. ${business.name}`);
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

  if (businesses().length === 0) {
    player.sendClientMessage(Color.error, "Бизнесы не загружены.");
    return;
  }

  const safePage = clampPage(page);
  pageByPlayer.set(id, safePage);
  const lines = pageLines(safePage);

  try {
    Dialog.show(
      player,
      TPBIZ_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Бизнесы (${safePage + 1}/${pageCount()})`,
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    pageByPlayer.delete(id);
    player.sendClientMessage(Color.error, "Не удалось открыть список бизнесов.");
  }
}

function pickFromPage(
  page: number,
  listItem: number,
  inputText: string
): number | "back" | "next" | null {
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
    const businessId = match ? Number(match[1]) : NaN;
    if (Number.isInteger(businessId) && getBusiness(businessId)) {
      return businessId;
    }
  }

  const typed = Number(raw.replace(/\D/g, ""));
  if (Number.isInteger(typed) && getBusiness(typed)) {
    return typed;
  }

  return null;
}

function teleportToBusiness(player: Player, business: BusinessRecord): boolean {
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }

  try {
    placeAt(player, {
      x: business.entranceX,
      y: business.entranceY,
      z: business.entranceZ,
      angle: 0,
      interior: 0,
      world: STREET_WORLD,
    });
    refreshStreamForPlayer(player);
    return true;
  } catch {
    return false;
  }
}

function goToBusiness(player: Player, business: BusinessRecord): void {
  if (!canTeleport(player)) {
    player.sendClientMessage(Color.error, "Сейчас нельзя телепортироваться.");
    return;
  }

  if (!teleportToBusiness(player, business)) {
    player.sendClientMessage(Color.error, "Не удалось телепортироваться.");
    return;
  }

  player.sendClientMessage(Color.info, `Телепорт к бизнесу #${business.id}: ${business.name}.`);
}

function clearPage(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pageByPlayer.delete(id);
  }
}

export function bindAdminTpbiz(): void {
  registerCommand(
    "tpbiz",
    "Телепорт к бизнесу",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const raw = args.trim();
      if (!raw) {
        showList(player, 0);
        return;
      }

      const businessId = Number(raw);
      const all = businesses();
      if (!Number.isInteger(businessId) || !getBusiness(businessId)) {
        const maxId = all.length > 0 ? all[all.length - 1]!.id : 0;
        player.sendClientMessage(
          Color.error,
          maxId > 0 ? `Использование: /tpbiz [1-${maxId}]` : "Бизнесы не загружены."
        );
        return;
      }

      const business = getBusiness(businessId);
      if (!business) {
        return;
      }

      goToBusiness(player, business);
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== TPBIZ_DIALOG_ID) {
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

    const business = getBusiness(picked);
    if (!business) {
      showList(player, page);
      return;
    }

    goToBusiness(player, business);
  });

  omp.on("playerConnect", (player) => {
    clearPage(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPage(player);
  });
}
