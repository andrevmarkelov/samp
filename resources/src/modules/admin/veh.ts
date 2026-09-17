import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { unregisterOrgVehicle } from "../vehicles/access";
import { clearVehicleLimit } from "../vehicles/limit";
import { createServerVehicle } from "../vehicles";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 3;
const MIN_MODEL = 400;
const MAX_MODEL = 611;
const MIN_COLOR = 0;
const MAX_COLOR = 255;
const DEFAULT_COLOR = 0;
const SPAWN_DISTANCE = 5;
const RESPAWN_SEC = -1;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

function parseArgs(
  args: string
): { model: number; color1: number; color2: number } | null {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || !parts[0]) {
    return null;
  }

  const model = Number(parts[0]);
  if (!Number.isInteger(model) || model < MIN_MODEL || model > MAX_MODEL) {
    return null;
  }

  if (parts.length === 1) {
    return { model, color1: DEFAULT_COLOR, color2: DEFAULT_COLOR };
  }

  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    return null;
  }

  const color1 = Number(parts[1]);
  const color2 = Number(parts[2]);
  if (
    !Number.isInteger(color1) ||
    !Number.isInteger(color2) ||
    color1 < MIN_COLOR ||
    color1 > MAX_COLOR ||
    color2 < MIN_COLOR ||
    color2 > MAX_COLOR
  ) {
    return null;
  }

  return { model, color1, color2 };
}

function canSpawn(player: Player): boolean {
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

function spawnInFront(player: Player): { x: number; y: number; z: number; angle: number; world: number; interior: number } | null {
  try {
    const pos = player.getPos();
    const angle = player.getFacingAngle();
    const rad = (angle * Math.PI) / 180;
    return {
      x: pos.x + SPAWN_DISTANCE * Math.sin(-rad),
      y: pos.y + SPAWN_DISTANCE * Math.cos(-rad),
      z: pos.z,
      angle,
      world: player.getVirtualWorld(),
      interior: player.getInterior(),
    };
  } catch {
    return null;
  }
}

export function bindAdminVeh(): void {
  registerCommand(
    "veh",
    "Sozdat' transport pered soboy",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /veh [id] [color1] [color2] (400-611, cveta 0-255)"
        );
        return;
      }

      if (!canSpawn(player)) {
        player.sendClientMessage(Color.error, "Seychas nel'zya sozdat' mashinu.");
        return;
      }

      const spot = spawnInFront(player);
      if (!spot) {
        player.sendClientMessage(Color.error, "Ne udalos' sozdat' mashinu.");
        return;
      }

      const vehicle = createServerVehicle({
        model: parsed.model,
        x: spot.x,
        y: spot.y,
        z: spot.z,
        angle: spot.angle,
        color1: parsed.color1,
        color2: parsed.color2,
        respawnSec: RESPAWN_SEC,
        world: spot.world,
      });

      if (!vehicle) {
        player.sendClientMessage(Color.error, "Ne udalos' sozdat' mashinu.");
        return;
      }

      try {
        vehicle.linkToInterior(spot.interior);
      } catch {
        // Мир уже выставлен при спавне.
      }

      player.sendClientMessage(
        Color.info,
        `Mashina sozdana: ${parsed.model} (${parsed.color1}, ${parsed.color2}).`
      );
    },
    true
  );

  registerCommand(
    "delveh",
    "Udalit' mashinu, v kotoroy sidish'",
    (player) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      let vehicle;
      try {
        if (!player.isInAnyVehicle()) {
          player.sendClientMessage(Color.error, "Vy dolzhny byt' v mashine.");
          return;
        }

        vehicle = omp.vehicles.at(player.getVehicleID());
      } catch {
        player.sendClientMessage(Color.error, "Vy dolzhny byt' v mashine.");
        return;
      }

      if (!vehicle) {
        player.sendClientMessage(Color.error, "Vy dolzhny byt' v mashine.");
        return;
      }

      clearVehicleLimit(vehicle);
      unregisterOrgVehicle(vehicle);

      try {
        vehicle.destroy();
      } catch {
        player.sendClientMessage(Color.error, "Ne udalos' udalit' mashinu.");
        return;
      }

      player.sendClientMessage(Color.info, "Mashina udalena.");
    },
    true
  );
}
