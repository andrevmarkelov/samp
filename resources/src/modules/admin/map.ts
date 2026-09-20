import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD } from "../spawn/point";
import { hasAdminAccess } from "./session";

function teleportToMapMark(player: Player, x: number, y: number, z: number): void {
  if (!hasAdminAccess(player, 1)) {
    return;
  }

  try {
    player.setInterior(0);
    player.setVirtualWorld(STREET_WORLD);

    const inVehicle = player.isInAnyVehicle();
    if (inVehicle) {
      const vehicleId = player.getVehicleID();
      const vehicle = omp.vehicles.at(vehicleId);
      if (vehicle) {
        vehicle.setVirtualWorld(STREET_WORLD);
        vehicle.setPos(x, y, z + 5);
        const seat = player.getVehicleSeat();
        player.putInVehicle(vehicle, seat >= 0 ? seat : 0);
      } else {
        player.setPos(x, y, z + 3);
      }
    } else {
      player.setPos(x, y, z + 3);
    }

    refreshStreamForPlayer(player);
    player.sendClientMessage(
      Color.white,
      "Вы успешно телепортировались на метку!"
    );
  } catch {
    // Игрок уже вышел.
  }
}

export function bindAdminMapTeleport(): void {
  omp.on("playerClickMap", (player, x, y, z) => {
    teleportToMapMark(player, x, y, z);
  });
}
