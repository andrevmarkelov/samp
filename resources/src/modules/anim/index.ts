import { Dialog, omp, TextDraw, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";
import {
  ANIM_COUNT,
  ANIMATIONS,
  dialogAnimList,
  type AnimEntry,
} from "./catalog";

export { ANIM_COUNT } from "./catalog";
export const ANIM_LIST_DIALOG_ID = 137;
export const ANIM_INFO_DIALOG_ID = 138;

const DIALOG_STYLE_LIST = 2;
const DIALOG_STYLE_MSGBOX = 0;
const PLAYER_STATE_ONFOOT = 1;
const ANIM_SYNC_ALL = 1;
const SPECIAL_ACTION_NONE = 0;
/** Левый ALT (KEY_WALK) — остановка анимации. */
const KEY_WALK = 1024;

const active = new Set<number>();
let stopTd: TextDraw | null = null;

function tryDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function createStopTd(): TextDraw | null {
  return tryDraw(() => {
    const draw = new TextDraw(
      630.0,
      432.0,
      "~w~Press ~g~L.ALT~w~ to stop the animation"
    );
    draw.setAlignment(3);
    draw.setBackgroundColor(0x000000ff);
    draw.setFont(2);
    draw.setOutline(1);
    draw.setLetterSize(0.28, 1.15);
    draw.setColor(0xffff00ff);
    draw.setProportional(true);
    draw.setShadow(0);
    draw.setSelectable(false);
    return draw;
  });
}

function isOnFoot(player: Player): boolean {
  try {
    return player.getState() === PLAYER_STATE_ONFOOT;
  } catch {
    return false;
  }
}

export function isPlayingAnim(player: Player): boolean {
  const id = playerId(player);
  return id !== null && active.has(id);
}

/** Сбросить special action / ApplyAnimation и спрятать TD (всегда). */
function forceClearAnim(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    active.delete(id);
    hideStopTd(player);
  }

  try {
    player.setSpecialAction(SPECIAL_ACTION_NONE);
  } catch {
    // Слот пуст.
  }

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Слот пуст.
  }
}

export function stopPlayerAnim(player: Player): boolean {
  const id = playerId(player);
  if (id === null || !active.has(id)) {
    return false;
  }

  forceClearAnim(player);
  return true;
}

function showStopTd(player: Player): void {
  if (!stopTd) {
    return;
  }

  try {
    stopTd.showForPlayer(player);
  } catch {
    // Слот пуст.
  }
}

function hideStopTd(player: Player): void {
  if (!stopTd) {
    return;
  }

  try {
    stopTd.hideForPlayer(player);
  } catch {
    // Слот пуст.
  }
}

function applyLibraryAnim(player: Player, entry: Extract<AnimEntry, { kind: "library" }>): void {
  // SA-MP: первый ApplyAnimation только подгружает библиотеку, второй — играет.
  player.applyAnimation(
    entry.lib,
    entry.name,
    entry.delta,
    entry.loop,
    entry.lockX,
    entry.lockY,
    entry.freeze,
    entry.time,
    ANIM_SYNC_ALL
  );
  player.applyAnimation(
    entry.lib,
    entry.name,
    entry.delta,
    entry.loop,
    entry.lockX,
    entry.lockY,
    entry.freeze,
    entry.time,
    ANIM_SYNC_ALL
  );
}

function applyEntry(player: Player, entry: AnimEntry): boolean {
  try {
    if (entry.kind === "special") {
      player.setSpecialAction(entry.action);
      return true;
    }

    applyLibraryAnim(player, entry);
    return true;
  } catch {
    return false;
  }
}

/** Подгрузить уникальные библиотеки заранее (на спавне). */
function preloadAnimLibraries(player: Player): void {
  const seen = new Set<string>();
  try {
    for (const entry of ANIMATIONS) {
      if (entry.kind !== "library" || seen.has(entry.lib)) {
        continue;
      }
      seen.add(entry.lib);
      player.applyAnimation(
        entry.lib,
        entry.name,
        4.1,
        false,
        false,
        false,
        false,
        1,
        ANIM_SYNC_ALL
      );
    }
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Подтянется при /anim.
  }
}

/**
 * Запустить анимацию по индексу 0..73.
 * @returns false — нельзя / неверный индекс.
 */
export function playAnimByIndex(player: Player, index: number): boolean {
  if (!isAuthenticated(player) || !isPlayerActive(player)) {
    return false;
  }

  if (!Number.isInteger(index) || index < 0 || index >= ANIM_COUNT) {
    return false;
  }

  if (!isOnFoot(player)) {
    player.sendClientMessage(
      Color.error,
      "Вы не можете использовать это в машине."
    );
    return false;
  }

  const entry = ANIMATIONS[index];
  if (!entry) {
    return false;
  }

  // Всегда чистим прошлую анимацию (не только если был наш TD).
  forceClearAnim(player);

  if (!applyEntry(player, entry)) {
    player.sendClientMessage(Color.error, "Не удалось запустить анимацию.");
    return false;
  }

  const id = playerId(player);
  if (id === null) {
    return false;
  }

  active.add(id);
  showStopTd(player);
  return true;
}

export function openAnimDialog(player: Player): void {
  if (!isOnFoot(player)) {
    player.sendClientMessage(
      Color.error,
      "Вы не можете использовать это в машине."
    );
    return;
  }

  try {
    Dialog.show(
      player,
      ANIM_LIST_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "{660099}Анимации",
      dialogAnimList(),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть список анимаций.");
  }
}

function showAnimInfo(player: Player): void {
  try {
    Dialog.show(
      player,
      ANIM_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "{FFCD00}Информация",
      "{FFFFFF}Для быстрого запуска нужной анимации можно использовать {66CC33}/anim [номер]{FFFFFF} из списка.",
      "Закрыть",
      ""
    );
  } catch {
    player.sendClientMessage(
      Color.info,
      "Быстрый запуск: /anim [номер] из списка."
    );
  }
}

export const animModule: GameModule = {
  name: "anim",
  start() {
    stopTd = createStopTd();

    omp.on("playerSpawn", (player) => {
      if (isAuthenticated(player)) {
        preloadAnimLibraries(player);
      }
    });

    omp.on("dialogResponse", (player, dialogId, response, listItem) => {
      if (Number(dialogId) !== ANIM_LIST_DIALOG_ID) {
        return;
      }

      if (Number(response) === 0 || !isAuthenticated(player)) {
        return;
      }

      const item = Number(listItem);
      if (!Number.isInteger(item) || item < 0 || item > ANIM_COUNT) {
        return;
      }

      if (item === ANIM_COUNT) {
        showAnimInfo(player);
        return;
      }

      playAnimByIndex(player, item);
    });

    omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
      const pressed = Number(newKeys) & ~Number(oldKeys);
      if ((pressed & KEY_WALK) === 0) {
        return;
      }

      if (!isAuthenticated(player) || !isPlayingAnim(player)) {
        return;
      }

      stopPlayerAnim(player);
    });

    omp.on("playerDeath", (player) => {
      forceClearAnim(player);
    });

    omp.on("playerConnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        active.delete(id);
      }
    });

    omp.on("playerDisconnect", (player) => {
      forceClearAnim(player);
    });

    omp.on("playerStateChange", (player, newState) => {
      const state = Number(newState);
      // Водитель / пассажир — сброс.
      if (state === 2 || state === 3) {
        forceClearAnim(player);
      }
    });
  },
};
