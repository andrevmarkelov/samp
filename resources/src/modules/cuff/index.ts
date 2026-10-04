import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import {
  saveUserHospitalized,
  saveUserJailedSeconds,
} from "../auth/repository";
import {
  MAX_HEALTH,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { clearWantedDecay, setPlayerWantedLevel } from "../auth/wanted";
import type { GameModule } from "../types";

const ANIM_SYNC_ALL = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
/** Максимальный срок как при 6★ (/arrest, сдача): 6 × 10 мин. */
const ESCAPE_JAIL_MINUTES = 60;

/** Сессионный флаг наручников (слот игрока). */
const cuffed = new Set<number>();

export function isCuffed(player: Player): boolean {
  const id = playerId(player);
  return id !== null && cuffed.has(id);
}

function setControllable(player: Player, enabled: boolean): void {
  try {
    player.toggleControllable(enabled);
  } catch {
    // Слот пуст.
  }
}

function leaveVehicle(player: Player): void {
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }
}

function applyCuffAnim(player: Player): void {
  try {
    // SA-MP: первый вызов подгружает библиотеку, второй — играет.
    player.applyAnimation("ped", "cpr_loop", 4.1, false, false, false, true, 0, ANIM_SYNC_ALL);
    player.applyAnimation("ped", "cpr_loop", 4.1, false, false, false, true, 0, ANIM_SYNC_ALL);
  } catch {
    // Слот пуст.
  }
}

function clearCuffAnim(player: Player): void {
  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Слот пуст.
  }
}

/** Надеть наручники: высадка из ТС, freeze, анимация. */
export function applyCuff(player: Player): boolean {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player) || cuffed.has(id)) {
    return false;
  }

  leaveVehicle(player);
  cuffed.add(id);
  setControllable(player, false);
  applyCuffAnim(player);
  return true;
}

/** Снять наручники и вернуть управление (если игрок ещё в слоте). */
export function clearCuff(player: Player): boolean {
  const id = playerId(player);
  if (id === null || !cuffed.has(id)) {
    return false;
  }

  cuffed.delete(id);

  if (!isPlayerActive(player) || playerId(player) !== id) {
    return true;
  }

  clearCuffAnim(player);
  setControllable(player, true);
  return true;
}

/** Повторно заморозить, если флаг наручников ещё висит (после телепорта и т.п.). */
export function refreshCuffFreeze(player: Player): void {
  if (!isCuffed(player)) {
    return;
  }

  setControllable(player, false);

  try {
    // ClearAnimations / cuff-anim в ТС выкидывает из машины (баг SA-MP).
    if (!player.isInAnyVehicle()) {
      applyCuffAnim(player);
    }
  } catch {
    applyCuffAnim(player);
  }
}

/** Кратко разморозить перед PutPlayerInVehicle (флаг наручников остаётся). */
export function releaseCuffForVehiclePut(player: Player): void {
  if (!isCuffed(player)) {
    return;
  }

  setControllable(player, true);
}

/** Снова заморозить после посадки в ТС. */
export function scheduleCuffRefreeze(player: Player, delayMs = 1000): void {
  const id = playerId(player);
  if (id === null || !cuffed.has(id)) {
    return;
  }

  setTimeout(() => {
    if (!isPlayerActive(player) || playerId(player) !== id || !cuffed.has(id)) {
      return;
    }

    refreshCuffFreeze(player);
  }, delayMs);
}

function clearSlot(slotId: number): void {
  cuffed.delete(slotId);
}

function broadcastAll(color: number, text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      other.sendClientMessage(color, text);
    } catch {
      // Слот пустой.
    }
  });
}

/**
 * Выход в наручниках → максимальный тюремный срок в БД + объявление всем.
 * Вызывать до persist.queueSave на disconnect, чтобы срок не перетёрся нулём.
 */
export function applyCuffDisconnectJail(player: Player): void {
  const slotId = playerId(player);
  if (slotId === null || !cuffed.has(slotId)) {
    return;
  }

  // Снимаем флаг сразу — повторный disconnect/handler не посадит дважды.
  cuffed.delete(slotId);

  if (!isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const seconds = ESCAPE_JAIL_MINUTES * 60;
  const name = account.name || playerName(player);

  patchAccount(player, {
    jailSeconds: seconds,
    hospitalized: false,
    health: MAX_HEALTH,
  });

  if (account.wantedLevel > 0) {
    setPlayerWantedLevel(player, 0);
  } else {
    clearWantedDecay(player);
  }

  broadcastAll(
    Color.error,
    `Игрок ${name} вышел при аресте и был отправлен в тюрьму.`
  );

  const userId = account.id;
  void saveUserJailedSeconds(userId, seconds).catch(() => {
    // persist.queueSave повторит jail_seconds из кэша.
  });
  void saveUserHospitalized(userId, false, MAX_HEALTH).catch(() => {
    // Не критично для посадки.
  });
}

export const cuffModule: GameModule = {
  name: "cuff",
  start() {
    // Смерть НЕ снимает флаг наручников: иначе выход с Wasted обходит тюрьму за побег.
    // Снятие — на spawn (больница) или через applyJail / uncuff / disconnect-штраф.

    omp.on("playerConnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearSlot(id);
      }
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearSlot(id);
      }
    });

    omp.on("playerSpawn", (player) => {
      // После смерти/респавна снимаем наручники. Флаг до spawn нужен, чтобы
      // выход с Wasted всё ещё ловил applyCuffDisconnectJail.
      if (isCuffed(player)) {
        clearCuff(player);
      }
    });

    omp.on("playerStateChange", (player, newState) => {
      if (!isCuffed(player)) {
        return;
      }

      const state = Number(newState);

      // Водительское место в наручниках запрещено.
      if (state === PLAYER_STATE_DRIVER) {
        leaveVehicle(player);
        refreshCuffFreeze(player);
        return;
      }

      // Пассажир (/putpl) — оставляем в ТС, только freeze без анимации.
      if (state === PLAYER_STATE_PASSENGER) {
        setControllable(player, false);
      }
    });
  },
};
