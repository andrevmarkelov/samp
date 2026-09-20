import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { registerCommand } from "./registry";
import {
  MAX_SPEED_LIMIT,
  MIN_SPEED_LIMIT,
  clearVehicleLimit,
  getVehicleLimit,
  setVehicleLimit,
} from "../vehicles/limit";

const PLAYER_STATE_DRIVER = 2;

registerCommand("limit", "Ограничитель скорости машины", (player, args) => {
  let vehicle;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      player.sendClientMessage(Color.error, "Вы должны быть за рулём.");
      return;
    }

    vehicle = omp.vehicles.at(player.getVehicleID());
  } catch {
    player.sendClientMessage(Color.error, "Вы должны быть за рулём.");
    return;
  }

  if (!vehicle) {
    player.sendClientMessage(Color.error, "Вы должны быть за рулём.");
    return;
  }

  const raw = args.trim();
  if (!raw) {
    const current = getVehicleLimit(vehicle);
    player.sendClientMessage(
      Color.info,
      current
        ? `Лимит этой машины: ${current} km/h.`
        : `Использование: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - выключить)`
    );
    return;
  }

  const kmh = Number(raw);
  if (!Number.isInteger(kmh) || kmh < 0) {
    player.sendClientMessage(
      Color.error,
      `Использование: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - выключить)`
    );
    return;
  }

  if (kmh === 0) {
    clearVehicleLimit(vehicle);
    player.sendClientMessage(Color.info, "Лимит скорости снят.");
    return;
  }

  if (kmh < MIN_SPEED_LIMIT || kmh > MAX_SPEED_LIMIT) {
    player.sendClientMessage(
      Color.error,
      `Использование: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - выключить)`
    );
    return;
  }

  const applied = setVehicleLimit(vehicle, kmh);
  if (applied === null) {
    player.sendClientMessage(Color.error, "Не удалось поставить лимит.");
    return;
  }

  player.sendClientMessage(Color.info, `Лимит скорости: ${applied} km/h.`);
});
