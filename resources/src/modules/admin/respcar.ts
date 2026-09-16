import { INVALID_VEHICLE_ID, omp, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const DELAY_MS = 30_000;
const MIN_LEVEL = 4;

let pending: ReturnType<typeof setTimeout> | null = null;

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

function vehicleHasPlayer(vehicle: Vehicle): boolean {
  try {
    if (vehicle.getDriver()) {
      return true;
    }
    return vehicle.countOccupants() > 0;
  } catch {
    return true;
  }
}

function occupiedVehicleIds(): Set<number> {
  const ids = new Set<number>();
  omp.players.forEach((player) => {
    try {
      if (!player.isInAnyVehicle()) {
        return;
      }

      const id = player.getVehicleID();
      if (id > 0 && id !== INVALID_VEHICLE_ID) {
        ids.add(id);
      }
    } catch {
      // Слот пустой.
    }
  });
  return ids;
}

function respawnEmptyVehicles(): void {
  const busy = occupiedVehicleIds();
  for (const vehicle of omp.vehicles.all()) {
    try {
      const id = vehicle.getID();
      if (id !== null && busy.has(id)) {
        continue;
      }

      if (vehicleHasPlayer(vehicle)) {
        continue;
      }

      vehicle.setToRespawn();
    } catch {
      // Транспорт уже уничтожен.
    }
  }
}

export function bindAdminRespcar(): void {
  registerCommand(
    "respcar",
    "Respawn vseh mashin cherez 30 sekund",
    (player) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      if (pending) {
        player.sendClientMessage(
          Color.error,
          "Taymer respawna transporta uzhe zapushchen."
        );
        return;
      }

      const tag = playerChatName(player);
      broadcastAll(
        Color.info,
        `Administrator ${tag} zapustil respawn transporta. Mashiny bez igrokov vernutsya na tochki cherez 30 sekund.`
      );

      pending = setTimeout(() => {
        pending = null;
        respawnEmptyVehicles();
        broadcastAll(
          Color.info,
          `Administrator ${tag} respavnil ves' svobodnyy transport na servere.`
        );
      }, DELAY_MS);
    },
    true
  );
}
