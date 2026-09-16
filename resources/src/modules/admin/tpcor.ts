import { INVALID_VEHICLE_ID, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { refreshStreamForPlayer } from "../mapping/stream";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 3;
const MAX_ABS_COORD = 20_000;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

function parseCoords(args: string): { x: number; y: number; z: number } | null {
  const parts = args.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (![x, y, z].every(Number.isFinite)) {
    return null;
  }

  if (Math.abs(x) > MAX_ABS_COORD || Math.abs(y) > MAX_ABS_COORD || Math.abs(z) > MAX_ABS_COORD) {
    return null;
  }

  return { x, y, z };
}

function formatCoord(value: number): string {
  return String(Number(value.toFixed(4)));
}

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

function teleportDriverVehicle(player: Player, x: number, y: number, z: number): boolean {
  try {
    if (!player.isInAnyVehicle() || player.getVehicleSeat() !== 0) {
      return false;
    }

    const vehicleId = player.getVehicleID();
    if (vehicleId <= 0 || vehicleId === INVALID_VEHICLE_ID) {
      return false;
    }

    const vehicle = omp.vehicles.at(vehicleId);
    if (!vehicle) {
      return false;
    }

    vehicle.setPos(x, y, z);
    player.putInVehicle(vehicle, 0);
    return true;
  } catch {
    return false;
  }
}

function teleportToCoords(player: Player, x: number, y: number, z: number): boolean {
  try {
    if (!teleportDriverVehicle(player, x, y, z)) {
      player.setPos(x, y, z);
    }

    player.setCameraBehind();
    refreshStreamForPlayer(player);
    return true;
  } catch {
    return false;
  }
}

export function bindAdminTpcor(): void {
  registerCommand(
    "tpcor",
    "Teleport po koordinatam XYZ",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseCoords(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /tpcor [x] [y] [z]"
        );
        return;
      }

      if (!canTeleport(player)) {
        player.sendClientMessage(Color.error, "Seychas nel'zya teleportirovat'sya.");
        return;
      }

      if (!teleportToCoords(player, parsed.x, parsed.y, parsed.z)) {
        player.sendClientMessage(Color.error, "Ne udalos' teleportirovat'sya.");
        return;
      }

      player.sendClientMessage(
        Color.info,
        `Vy teleportirovalis': ${formatCoord(parsed.x)}, ${formatCoord(parsed.y)}, ${formatCoord(parsed.z)}.`
      );
    },
    true
  );
}
