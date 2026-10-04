import { omp } from "@omp-node/core";
import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { registerCommand } from "./registry";

const PLAYER_STATE_DRIVER = 2;

function parseSlot(args: string): number | null {
  const raw = args.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  if (!raw) {
    return null;
  }

  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }

  return slot;
}

function findTarget(slot: number): Player | null {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
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

function driverVehicleId(player: Player): number | null {
  try {
    if (!player.isInAnyVehicle() || player.getState() !== PLAYER_STATE_DRIVER) {
      return null;
    }

    const vehicleId = player.getVehicleID();
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return null;
    }

    if (!omp.vehicles.at(vehicleId)) {
      return null;
    }

    return vehicleId;
  } catch {
    return null;
  }
}

registerCommand(
  "eject",
  "Выкинуть игрока из своего транспорта",
  (player, args) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const vehicleId = driverVehicleId(player);
    if (vehicleId === null) {
      player.sendClientMessage(Color.error, "Вы должны быть за рулём.");
      return;
    }

    const slot = parseSlot(args);
    if (slot === null) {
      player.sendClientMessage(Color.error, "Использование: /eject [id]");
      return;
    }

    const target = findTarget(slot);
    if (!target) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    const selfId = playerId(player);
    const targetId = playerId(target);
    if (target === player || (selfId !== null && selfId === targetId)) {
      player.sendClientMessage(Color.error, "Нельзя выкинуть самого себя.");
      return;
    }

    try {
      if (!target.isInAnyVehicle()) {
        player.sendClientMessage(Color.error, "Этот игрок не в транспорте.");
        return;
      }

      if (target.getVehicleID() !== vehicleId) {
        player.sendClientMessage(Color.error, "Этот игрок не в вашем транспорте.");
        return;
      }

      // Повторная проверка: водитель мог выйти / сменить ТС между проверками.
      if (driverVehicleId(player) !== vehicleId) {
        player.sendClientMessage(Color.error, "Вы должны быть за рулём.");
        return;
      }

      target.removeFromVehicle();
    } catch {
      player.sendClientMessage(Color.error, "Не удалось выкинуть игрока.");
      return;
    }

    player.sendClientMessage(
      Color.info,
      `Вы выкинули из машины ${playerName(target)}.`
    );
    try {
      target.sendClientMessage(
        Color.info,
        `${playerName(player)} выкинул вас из машины.`
      );
    } catch {
      // Уже вышел.
    }
  }
);
