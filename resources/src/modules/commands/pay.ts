import { omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { WHISPER_RADIUS, arePlayersNearby } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { transferUserCash } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { registerCommand } from "./registry";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;
/** Потолок наличных как у админ `/givemoney`. */
const MAX_CASH = 2_147_483_647;
const LABEL_MS = 3500;
const LABEL_OFFSET_Z = 1.1;
const LABEL_DRAW_DISTANCE = 20;
const COLOR_PAY_OUT = 0xff0000ff;
const COLOR_PAY_IN = 0x99ff99ff;

type FloatLabel = {
  label: TextLabel;
  timer: ReturnType<typeof setTimeout>;
};

const labels = new Map<number, FloatLabel>();
const busy = new Set<number>();

registerCommand("pay", "Передать наличные игроку рядом", (player, args) => {
  void handlePay(player, args);
});

export function bindPayLabels(): void {
  omp.on("playerDisconnect", (player) => {
    hidePayLabel(player);
    const id = playerId(player);
    if (id !== null) {
      busy.delete(id);
    }
  });
}

async function handlePay(player: Player, args: string): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const parsed = parseArgs(args);
  if (!parsed) {
    player.sendClientMessage(
      Color.error,
      `Использование: /pay [id] [сумма ${MIN_AMOUNT}-${MAX_AMOUNT}]`
    );
    return;
  }

  const senderId = playerId(player);
  if (senderId === null) {
    return;
  }

  if (parsed.slot === senderId) {
    player.sendClientMessage(Color.error, "Нельзя передать деньги самому себе.");
    return;
  }

  const target = findPlayer(parsed.slot);
  if (!target) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!getAccount(target)) {
    player.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Игрок слишком далеко.");
    return;
  }

  const targetId = playerId(target);
  if (targetId === null) {
    return;
  }

  if (busy.has(senderId) || busy.has(targetId)) {
    player.sendClientMessage(Color.error, "Подождите, операция ещё выполняется.");
    return;
  }

  busy.add(senderId);
  busy.add(targetId);

  try {
    const senderLive = getAccount(player);
    const targetLive = getAccount(target);
    if (!senderLive || !targetLive) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
      player.sendClientMessage(Color.error, "Игрок слишком далеко.");
      return;
    }

    const amount = parsed.amount;
    const senderCash = Math.max(0, Math.floor(senderLive.money));
    const targetCash = Math.max(0, Math.floor(targetLive.money));
    if (senderCash < amount) {
      player.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }

    if (targetCash > MAX_CASH - amount) {
      player.sendClientMessage(Color.error, "У игрока слишком много наличных.");
      return;
    }

    let ok = false;
    try {
      ok = await transferUserCash(senderLive.id, targetLive.id, amount);
    } catch {
      try {
        player.sendClientMessage(
          Color.error,
          "Не удалось передать деньги. Попробуйте позже."
        );
      } catch {
        // Отправитель уже вышел.
      }
      return;
    }

    if (!ok) {
      try {
        player.sendClientMessage(Color.error, "Недостаточно наличных.");
      } catch {
        // Отправитель уже вышел.
      }
      return;
    }

    // Память только после успеха БД: дельта от текущего снимка (учитывает гонки).
    applyCashDelta(player, -amount);
    applyCashDelta(target, amount);

    const pretty = formatMoney(amount);

    if (isPlayerActive(player) && getAccount(player)) {
      const targetTag = isPlayerActive(target)
        ? playerChatName(target)
        : "игроку";
      try {
        player.sendClientMessage(
          Color.info,
          `Вы передали ${pretty} игроку ${targetTag}.`
        );
        showPayLabel(player, `-${pretty}`, COLOR_PAY_OUT);
      } catch {
        // Слот уже пуст.
      }
    }

    if (isPlayerActive(target) && getAccount(target)) {
      const senderTag = isPlayerActive(player)
        ? playerChatName(player)
        : "Игрок";
      try {
        target.sendClientMessage(
          Color.info,
          `${senderTag} передал вам ${pretty}.`
        );
        showPayLabel(target, `+${pretty}`, COLOR_PAY_IN);
      } catch {
        // Слот уже пуст.
      }
    }
  } finally {
    busy.delete(senderId);
    busy.delete(targetId);
  }
}

function applyCashDelta(player: Player, delta: number): void {
  if (!isPlayerActive(player)) {
    return;
  }

  const live = getAccount(player);
  if (!live) {
    return;
  }

  const next = Math.max(0, Math.min(MAX_CASH, Math.floor(live.money) + delta));
  patchAccount(player, { money: next });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
}

function parseArgs(args: string): { slot: number; amount: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const amount = Number(parts[1].replace(/^\$/, ""));
  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }

  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return null;
  }

  return { slot, amount };
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

function showPayLabel(player: Player, text: string, color: number): void {
  hidePayLabel(player);

  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    const pos = player.getPos();
    const label = new TextLabel(
      text,
      color,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      player.getVirtualWorld(),
      false
    );
    label.attachToPlayer(player, 0, 0, LABEL_OFFSET_Z);

    const timer = setTimeout(() => {
      hidePayLabelById(id);
    }, LABEL_MS);

    labels.set(id, { label, timer });
  } catch {
    // Слот уже невалиден.
  }
}

function hidePayLabel(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  hidePayLabelById(id);
}

function hidePayLabelById(id: number): void {
  const current = labels.get(id);
  if (!current) {
    return;
  }

  labels.delete(id);
  clearTimeout(current.timer);
  try {
    current.label.destroy();
  } catch {
    // Уже снята.
  }
}
