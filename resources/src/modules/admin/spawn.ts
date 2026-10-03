import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import {
  applyHealth,
  getAccount,
  isAuthenticated,
  normalizeHealth,
} from "../auth/session";
import { registerCommand } from "../commands/registry";
import { refreshStreamForPlayer } from "../mapping/stream";
import { applyOrgVisuals, resolvePlayerSkin } from "../org";
import { clearPendingHospitalSpawn } from "../spawn";
import { placeAt, writeSpawnInfo } from "../spawn/point";
import { resolveAccountSpawn } from "../spawn/resolve";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 3;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;
const PLACE_AFTER_SPAWN_MS = 80;

function broadcastAdmins(text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !hasAdminAccess(other, 1)) {
      return;
    }

    try {
      other.sendClientMessage(Color.gray, text);
    } catch {
      // Слот пустой.
    }
  });
}

function findTarget(slot: number): Player | null {
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

function leaveVehicle(player: Player): void {
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Уже пешком.
  }
}

function needsForceSpawn(player: Player): boolean {
  try {
    if (!player.isSpawned()) {
      return true;
    }

    const state = player.getState();
    return state === PLAYER_STATE_WASTED || state === PLAYER_STATE_SPECTATING;
  } catch {
    return true;
  }
}

function exitSpectate(player: Player): void {
  try {
    player.toggleSpectating(false);
  } catch {
    // Уже не в спеке.
  }

  try {
    player.toggleControllable(true);
  } catch {
    // Управление выставится после placeAt.
  }
}

function placeSpawnedPlayer(target: Player): boolean {
  const account = getAccount(target);
  if (!account || !isAuthenticated(target) || !isPlayerActive(target)) {
    return false;
  }

  const point = resolveAccountSpawn(account);

  try {
    leaveVehicle(target);
    applyOrgVisuals(target);
    placeAt(target, point);
    applyHealth(target, normalizeHealth(account.health));
    refreshStreamForPlayer(target);
    return true;
  } catch {
    return false;
  }
}

function spawnToAccountPoint(target: Player): boolean {
  const account = getAccount(target);
  if (!account || !isAuthenticated(target)) {
    return false;
  }

  const targetSlot = playerId(target);
  if (targetSlot === null) {
    return false;
  }

  const point = resolveAccountSpawn(account);
  const skin = resolvePlayerSkin(account);
  const force = needsForceSpawn(target);

  leaveVehicle(target);
  exitSpectate(target);

  // Иначе OnPlayerSpawn покажет «Вы потеряли сознание…» поверх админ-спавна.
  clearPendingHospitalSpawn(target);

  try {
    if (force) {
      writeSpawnInfo(target, skin, point);
      target.spawn();
      // Ждём OnPlayerSpawn — иначе placeAt может перетереться хендлером смерти/больницы.
      setTimeout(() => {
        if (!isPlayerActive(target) || playerId(target) !== targetSlot) {
          return;
        }

        if (!isAuthenticated(target) || getAccount(target)?.id !== account.id) {
          return;
        }

        placeSpawnedPlayer(target);
      }, PLACE_AFTER_SPAWN_MS);
      return true;
    }

    return placeSpawnedPlayer(target);
  } catch {
    return false;
  }
}

export function bindAdminSpawn(): void {
  registerCommand(
    "spawn",
    "Заспавнить себя или игрока",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const raw = args.trim();
      let target = player;

      if (raw) {
        if (!/^\d+$/.test(raw)) {
          player.sendClientMessage(Color.error, "Использование: /spawn [id]");
          return;
        }

        const slot = Number(raw);
        if (!Number.isInteger(slot) || slot < 0) {
          player.sendClientMessage(Color.error, "Использование: /spawn [id]");
          return;
        }

        const found = findTarget(slot);
        if (!found || !isAuthenticated(found)) {
          player.sendClientMessage(Color.error, "Игрок не найден.");
          return;
        }

        target = found;
      } else if (!isAuthenticated(player)) {
        player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
        return;
      }

      if (!spawnToAccountPoint(target)) {
        player.sendClientMessage(Color.error, "Не удалось заспавнить игрока.");
        return;
      }

      const adminId = playerId(player);
      const targetId = playerId(target);
      const self = adminId !== null && adminId === targetId;

      if (self) {
        player.sendClientMessage(Color.info, "Вы заспавнены.");
        broadcastAdmins(`Администратор ${playerChatName(player)} заспавнил себя.`);
        return;
      }

      player.sendClientMessage(
        Color.info,
        `Вы заспавнили игрока ${playerChatName(target)}.`
      );
      try {
        target.sendClientMessage(
          Color.info,
          `Администратор ${playerChatName(player)} заспавнил вас.`
        );
      } catch {
        // Уже вышел.
      }

      broadcastAdmins(
        `Администратор ${playerChatName(player)} заспавнил ${playerChatName(target)}.`
      );
    },
    true
  );
}
