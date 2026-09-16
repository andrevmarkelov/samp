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

registerCommand("limit", "Ogranichitel' skorosti mashiny", (player, args) => {
  let vehicle;
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      player.sendClientMessage(Color.error, "Vy dolzhny byt' za rulem.");
      return;
    }

    vehicle = omp.vehicles.at(player.getVehicleID());
  } catch {
    player.sendClientMessage(Color.error, "Vy dolzhny byt' za rulem.");
    return;
  }

  if (!vehicle) {
    player.sendClientMessage(Color.error, "Vy dolzhny byt' za rulem.");
    return;
  }

  const raw = args.trim();
  if (!raw) {
    const current = getVehicleLimit(vehicle);
    player.sendClientMessage(
      Color.info,
      current
        ? `Limit etoy mashiny: ${current} km/h.`
        : `Ispol'zovanie: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - vyklyuchit')`
    );
    return;
  }

  const kmh = Number(raw);
  if (!Number.isInteger(kmh) || kmh < 0) {
    player.sendClientMessage(
      Color.error,
      `Ispol'zovanie: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - vyklyuchit')`
    );
    return;
  }

  if (kmh === 0) {
    clearVehicleLimit(vehicle);
    player.sendClientMessage(Color.info, "Limit skorosti snyat.");
    return;
  }

  if (kmh < MIN_SPEED_LIMIT || kmh > MAX_SPEED_LIMIT) {
    player.sendClientMessage(
      Color.error,
      `Ispol'zovanie: /limit [kmh] (${MIN_SPEED_LIMIT}-${MAX_SPEED_LIMIT}, 0 - vyklyuchit')`
    );
    return;
  }

  const applied = setVehicleLimit(vehicle, kmh);
  if (applied === null) {
    player.sendClientMessage(Color.error, "Ne udalos' postavit' limit.");
    return;
  }

  player.sendClientMessage(Color.info, `Limit skorosti: ${applied} km/h.`);
});
