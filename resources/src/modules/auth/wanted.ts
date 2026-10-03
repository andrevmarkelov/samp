import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserWantedLevel } from "./repository";
import {
  applyWantedLevel,
  getAccount,
  isAuthenticated,
  normalizeWantedLevel,
  patchAccount,
} from "./session";

const DECAY_MS = 20 * 60 * 1000;
const TICK_MS = 5000;

/** Слот → когда следующий −1 к розыску (только online). */
const nextDecayAt = new Map<number, number>();

/** Выставить розыск 0–6: кэш, звёзды SA, БД. */
export function setPlayerWantedLevel(player: Player, level: number): void {
  const wanted = normalizeWantedLevel(level);
  const account = getAccount(player);
  if (!account) {
    return;
  }

  patchAccount(player, { wantedLevel: wanted });
  applyWantedLevel(player, wanted);
  void saveUserWantedLevel(account.id, wanted).catch(() => {
    // Кэш и клиент уже обновлены.
  });
  syncWantedDecay(player);
}

/**
 * Запустить/остановить таймер снижения розыска.
 * Не сбрасывает уже идущий отсчёт (чтобы /su не обнулял 20 минут).
 */
export function syncWantedDecay(player: Player): void {
  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return;
  }

  if (account.wantedLevel <= 0) {
    nextDecayAt.delete(slot);
    return;
  }

  if (!nextDecayAt.has(slot)) {
    nextDecayAt.set(slot, Date.now() + DECAY_MS);
  }
}

export function clearWantedDecay(player: Player): void {
  const slot = playerId(player);
  if (slot !== null) {
    nextDecayAt.delete(slot);
  }
}

export function bindWantedDecay(): void {
  setInterval(tickWantedDecay, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    clearWantedDecay(player);
  });
}

function tickWantedDecay(): void {
  const now = Date.now();

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    const due = nextDecayAt.get(slot);
    if (due === undefined || now < due) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.wantedLevel <= 0) {
      nextDecayAt.delete(slot);
      return;
    }

    const next = account.wantedLevel - 1;
    // Сброс слота до set — syncWantedDecay заново поставит +20 мин, если розыск ещё есть.
    nextDecayAt.delete(slot);
    setPlayerWantedLevel(player, next);

    try {
      if (next > 0) {
        player.sendClientMessage(
          Color.info,
          `Уровень розыска снижен: ${next}.`
        );
      } else {
        player.sendClientMessage(Color.info, "Розыск снят: срок давности.");
      }
    } catch {
      // Уже вышел.
    }
  });
}
