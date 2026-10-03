import { Checkpoint, Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId, playerName } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { isLawOfficer } from "../org/law";
import { STREET_WORLD } from "../spawn/point";
import { clearWantedByOfficer, setWantedClearedHook } from "./clear";
import { registerCommand } from "./registry";

export const WANTED_LIST_DIALOG_ID = 127;
export const WANTED_ACTION_DIALOG_ID = 128;

const DIALOG_STYLE_LIST = 2;
const PLAYER_STATE_WASTED = 7;
const CHECKPOINT_RADIUS = 3;
const PURSUIT_TICK_MS = 5000;
const DENY = "Команда доступна сотрудникам полиции и FBI.";

type WantedRow = {
  slot: number;
  accountId: number;
  line: string;
  wanted: number;
  name: string;
};

type PendingTarget = {
  slot: number;
  accountId: number;
};

type Pursuit = {
  targetSlot: number;
  targetAccountId: number;
  timer: ReturnType<typeof setInterval>;
};

const pendingTarget = new Map<number, PendingTarget>();
const wantedLists = new Map<number, PendingTarget[]>();
const pursuits = new Map<number, Pursuit>();

registerCommand("wanted", "Список игроков в розыске", (player) => {
  if (!isAuthenticated(player) || !isLawOfficer(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  const rows = collectWantedOnline();
  if (rows.length === 0) {
    player.sendClientMessage(Color.info, "В сети нет игроков в розыске.");
    return;
  }

  const officerId = playerId(player);
  if (officerId === null) {
    return;
  }

  wantedLists.set(
    officerId,
    rows.map((row) => ({ slot: row.slot, accountId: row.accountId }))
  );

  try {
    Dialog.show(
      player,
      WANTED_LIST_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `В розыске: ${rows.length}`,
      rows.map((row) => row.line).join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    wantedLists.delete(officerId);
    player.sendClientMessage(Color.error, "Не удалось открыть список.");
  }
});

registerCommand("pursuit", "Прекратить слежку за розыскным", (player) => {
  if (!isAuthenticated(player) || !isLawOfficer(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  const officerId = playerId(player);
  if (officerId === null || !pursuits.has(officerId)) {
    player.sendClientMessage(Color.error, "Вы ни за кем не следите.");
    return;
  }

  stopPursuit(player, officerId, "Слежка прекращена.");
});

export function bindWantedDialogs(): void {
  setWantedClearedHook(stopPursuitsOfTarget);

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    const id = Number(dialogId);
    if (id !== WANTED_LIST_DIALOG_ID && id !== WANTED_ACTION_DIALOG_ID) {
      return;
    }

    if (!isAuthenticated(player) || !isLawOfficer(player)) {
      clearPending(player);
      return;
    }

    const officerId = playerId(player);
    if (officerId === null) {
      return;
    }

    if (Number(response) === 0) {
      clearPending(player);
      return;
    }

    if (id === WANTED_LIST_DIALOG_ID) {
      const slots = wantedLists.get(officerId);
      wantedLists.delete(officerId);
      if (!slots) {
        return;
      }

      const picked = slots[Number(listItem)];
      if (!picked) {
        return;
      }

      const target = resolveTarget(picked);
      if (!target) {
        player.sendClientMessage(
          Color.error,
          "Игрок не найден или уже не в розыске."
        );
        return;
      }

      pendingTarget.set(officerId, picked);
      try {
        Dialog.show(
          player,
          WANTED_ACTION_DIALOG_ID,
          DIALOG_STYLE_LIST,
          playerChatName(target),
          "1. Найти\n2. Снять розыск",
          "Выбрать",
          "Отмена"
        );
      } catch {
        pendingTarget.delete(officerId);
        player.sendClientMessage(Color.error, "Не удалось открыть меню.");
      }
      return;
    }

    const picked = pendingTarget.get(officerId);
    pendingTarget.delete(officerId);
    if (!picked) {
      return;
    }

    const target = resolveTarget(picked);
    if (!target) {
      player.sendClientMessage(
        Color.error,
        "Игрок не найден или уже не в розыске."
      );
      return;
    }

    const action = Number(listItem);
    if (action === 0) {
      startPursuit(player, target);
      return;
    }

    if (action === 1) {
      const error = clearWantedByOfficer(player, target);
      if (error) {
        player.sendClientMessage(Color.error, error);
        return;
      }
      player.sendClientMessage(
        Color.info,
        `Вы сняли розыск с игрока ${playerChatName(target)}.`
      );
    }
  });

  omp.on("playerDisconnect", (player) => {
    onOfficerGone(player);
    onTargetGone(player, "Цель вышла из игры. Слежка прекращена.");
  });

  omp.on("playerDeath", (player) => {
    onTargetGone(player, "Цель погибла. Слежка прекращена.");
  });
}

/** Срыв слежки у всех офицеров, когда с цели сняли розыск. */
function stopPursuitsOfTarget(
  accountId: number | undefined,
  slot: number | null
): void {
  for (const [officerId, pursuit] of [...pursuits.entries()]) {
    const matchSlot = slot !== null && pursuit.targetSlot === slot;
    const matchAccount =
      accountId !== undefined && pursuit.targetAccountId === accountId;
    if (!matchSlot && !matchAccount) {
      continue;
    }

    const officer = findPlayer(officerId);
    if (officer) {
      stopPursuit(officer, officerId, "У цели сняли розыск. Слежка прекращена.");
    } else {
      clearPursuitById(officerId);
    }
  }
}

function collectWantedOnline(): WantedRow[] {
  const rows: WantedRow[] = [];

  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !isAuthenticated(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const account = getAccount(other);
    if (!account || account.wantedLevel <= 0) {
      return;
    }

    const slot = playerId(other);
    if (slot === null) {
      return;
    }

    rows.push({
      slot,
      accountId: account.id,
      wanted: account.wantedLevel,
      name: playerName(other),
      line: `${playerChatName(other)} | розыск: ${account.wantedLevel}`,
    });
  });

  rows.sort((a, b) => b.wanted - a.wanted || a.name.localeCompare(b.name));
  return rows;
}

function startPursuit(officer: Player, target: Player): void {
  const officerId = playerId(officer);
  const targetSlot = playerId(target);
  const targetAccount = getAccount(target);
  if (officerId === null || targetSlot === null || !targetAccount) {
    officer.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (targetSlot === officerId) {
    officer.sendClientMessage(Color.error, "Нельзя следить за собой.");
    return;
  }

  if (targetAccount.wantedLevel <= 0) {
    officer.sendClientMessage(Color.error, "Этот игрок не в розыске.");
    return;
  }

  const hidden = trackBlockReason(target);
  if (hidden) {
    officer.sendClientMessage(Color.error, hidden);
    return;
  }

  stopPursuit(officer, officerId);

  const timer = setInterval(() => {
    tickPursuit(officerId);
  }, PURSUIT_TICK_MS);

  pursuits.set(officerId, {
    targetSlot,
    targetAccountId: targetAccount.id,
    timer,
  });

  if (!updatePursuitCheckpoint(officer, target)) {
    stopPursuit(officer, officerId, "Не удалось начать слежку.");
    return;
  }

  officer.sendClientMessage(
    Color.info,
    `Слежка за ${playerChatName(target)}. Прекратить: /pursuit.`
  );
}

function tickPursuit(officerId: number): void {
  const pursuit = pursuits.get(officerId);
  if (!pursuit) {
    return;
  }

  const officer = findPlayer(officerId);
  if (!officer || !isAuthenticated(officer) || !isLawOfficer(officer)) {
    if (officer) {
      stopPursuit(officer, officerId);
    } else {
      clearPursuitById(officerId);
    }
    return;
  }

  const target = findPlayer(pursuit.targetSlot);
  const targetAccount = target ? getAccount(target) : null;
  if (!target || !targetAccount || targetAccount.id !== pursuit.targetAccountId) {
    stopPursuit(officer, officerId, "Цель вышла из игры. Слежка прекращена.");
    return;
  }

  if (targetAccount.wantedLevel <= 0) {
    stopPursuit(officer, officerId, "У цели сняли розыск. Слежка прекращена.");
    return;
  }

  try {
    if (target.getState() === PLAYER_STATE_WASTED) {
      stopPursuit(officer, officerId, "Цель погибла. Слежка прекращена.");
      return;
    }
  } catch {
    stopPursuit(officer, officerId, "Цель вышла из игры. Слежка прекращена.");
    return;
  }

  const hidden = trackBlockReason(target);
  if (hidden) {
    stopPursuit(officer, officerId, "Цель скрылась. Слежка прекращена.");
    return;
  }

  updatePursuitCheckpoint(officer, target);
}

/** `null` — можно следить (улица, VW 0). */
function trackBlockReason(target: Player): string | null {
  try {
    if (target.getInterior() > 0) {
      return "Нельзя следить за игроком в интерьере.";
    }

    if (target.getVirtualWorld() !== STREET_WORLD) {
      return "Нельзя следить за игроком в виртуальном мире.";
    }

    return null;
  } catch {
    return "Игрок не найден.";
  }
}

function updatePursuitCheckpoint(officer: Player, target: Player): boolean {
  try {
    const pos = target.getPos();
    Checkpoint.set(officer, pos.x, pos.y, pos.z, CHECKPOINT_RADIUS);
    return true;
  } catch {
    return false;
  }
}

function stopPursuit(
  officer: Player,
  officerId: number,
  message?: string
): void {
  clearPursuitById(officerId);
  try {
    Checkpoint.disable(officer);
  } catch {
    // Уже вышел.
  }

  if (message) {
    try {
      if (isPlayerActive(officer)) {
        officer.sendClientMessage(Color.info, message);
      }
    } catch {
      // Слот пуст.
    }
  }
}

function clearPursuitById(officerId: number): void {
  const pursuit = pursuits.get(officerId);
  if (!pursuit) {
    return;
  }

  clearInterval(pursuit.timer);
  pursuits.delete(officerId);
}

function onOfficerGone(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  clearPending(player);
  clearPursuitById(id);
}

function onTargetGone(player: Player, message: string): void {
  const targetSlot = playerId(player);
  const accountId = getAccount(player)?.id;
  if (targetSlot === null) {
    return;
  }

  for (const [officerId, pursuit] of [...pursuits.entries()]) {
    const matchSlot = pursuit.targetSlot === targetSlot;
    const matchAccount =
      accountId !== undefined && pursuit.targetAccountId === accountId;
    if (!matchSlot && !matchAccount) {
      continue;
    }

    const officer = findPlayer(officerId);
    if (officer) {
      stopPursuit(officer, officerId, message);
    } else {
      clearPursuitById(officerId);
    }
  }
}

function clearPending(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingTarget.delete(id);
    wantedLists.delete(id);
  }
}

function resolveTarget(picked: PendingTarget): Player | null {
  const target = findPlayer(picked.slot);
  const account = target ? getAccount(target) : null;
  if (!target || !account || account.id !== picked.accountId) {
    return null;
  }

  if (account.wantedLevel <= 0) {
    return null;
  }

  return target;
}

function findPlayer(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    return null;
  }

  try {
    if (target.isNPC()) {
      return null;
    }
  } catch {
    return null;
  }

  return target;
}
