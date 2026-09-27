import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { refreshStreamForPlayer } from "../mapping/stream";
import { placeAt, type SpawnPoint } from "../spawn/point";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 2;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

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

function parseSlot(args: string): number | null {
  const idPart = args.trim();
  if (!idPart) {
    return null;
  }

  const slot = Number(idPart);
  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }

  return slot;
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

function readPoint(player: Player): SpawnPoint | null {
  try {
    const pos = player.getPos();
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      angle: player.getFacingAngle(),
      interior: player.getInterior(),
      world: player.getVirtualWorld(),
    };
  } catch {
    return null;
  }
}

function teleportPlayer(player: Player, point: SpawnPoint): boolean {
  leaveVehicle(player);

  try {
    placeAt(player, point);
    refreshStreamForPlayer(player);
    return true;
  } catch {
    return false;
  }
}

function isSamePlayer(a: Player, b: Player): boolean {
  const aId = playerId(a);
  const bId = playerId(b);
  return aId !== null && aId === bId;
}

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

export function bindAdminGoto(): void {
  registerCommand(
    "goto",
    "Телепорт к игроку",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const slot = parseSlot(args);
      if (slot === null) {
        player.sendClientMessage(Color.error, "Использование: /goto [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (isSamePlayer(player, target)) {
        player.sendClientMessage(Color.error, "Нельзя телепортироваться к себе.");
        return;
      }

      if (!canTeleport(player)) {
        player.sendClientMessage(Color.error, "Сейчас нельзя телепортироваться.");
        return;
      }

      const point = readPoint(target);
      if (!point || !teleportPlayer(player, point)) {
        player.sendClientMessage(Color.error, "Не удалось телепортироваться.");
        return;
      }

      player.sendClientMessage(
        Color.info,
        `Вы телепортировались к ${playerChatName(target)}.`
      );
      broadcastAdmins(
        `Администратор ${playerChatName(player)} телепортировался к ${playerChatName(target)}.`
      );
    },
    true
  );

  registerCommand(
    "gethere",
    "Телепорт игрока к себе",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const slot = parseSlot(args);
      if (slot === null) {
        player.sendClientMessage(Color.error, "Использование: /gethere [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (isSamePlayer(player, target)) {
        player.sendClientMessage(Color.error, "Нельзя телепортировать себя.");
        return;
      }

      if (!canTeleport(target)) {
        player.sendClientMessage(Color.error, "Сейчас нельзя телепортировать игрока.");
        return;
      }

      const point = readPoint(player);
      if (!point || !teleportPlayer(target, point)) {
        player.sendClientMessage(Color.error, "Не удалось телепортировать игрока.");
        return;
      }

      player.sendClientMessage(
        Color.info,
        `Вы телепортировали к себе ${playerChatName(target)}.`
      );
      try {
        target.sendClientMessage(
          Color.info,
          `Администратор ${playerChatName(player)} телепортировал вас.`
        );
      } catch {
        // Игрок уже вышел.
      }

      broadcastAdmins(
        `[A] Администратор ${playerChatName(player)} телепортировал к себе игрока ${playerChatName(target)}`
      );
    },
    true
  );
}
