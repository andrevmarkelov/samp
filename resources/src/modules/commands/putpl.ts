import { omp, type Player, type Vehicle } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS, WHISPER_RADIUS, arePlayersNearby, sendNearby } from "../../shared/nearby";
import { isPlayerActive, playerName } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount } from "../auth/session";
import {
  isCuffed,
  releaseCuffForVehiclePut,
  scheduleCuffRefreeze,
} from "../cuff";
import { isJailed } from "../prison/sentence";
import { resolveLawNearbyTarget } from "./law-target";
import { registerCommand } from "./registry";

const PLAYER_STATE_DRIVER = 2;
const PASSENGER_SEATS = [1, 2, 3] as const;

registerCommand(
  "putpl",
  "Посадить игрока в свой транспорт (полиция / FBI)",
  (player, args) => {
    const resolved = resolveLawNearbyTarget(
      player,
      args,
      "Использование: /putpl [id]"
    );
    if (!resolved.ok) {
      return;
    }

    const { officer, target } = resolved;

    if (isJailed(target)) {
      officer.sendClientMessage(Color.error, "Игрок уже в тюрьме.");
      return;
    }

    let vehicle: Vehicle | null = null;
    let vehicleId = -1;
    try {
      if (!officer.isInAnyVehicle() || officer.getState() !== PLAYER_STATE_DRIVER) {
        officer.sendClientMessage(Color.error, "Вы должны быть за рулём.");
        return;
      }

      vehicleId = officer.getVehicleID();
      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        officer.sendClientMessage(Color.error, "Вы должны быть за рулём.");
        return;
      }

      vehicle = omp.vehicles.at(vehicleId) ?? null;
    } catch {
      officer.sendClientMessage(Color.error, "Вы должны быть за рулём.");
      return;
    }

    if (!vehicle) {
      officer.sendClientMessage(Color.error, "Вы должны быть за рулём.");
      return;
    }

    try {
      if (target.isInAnyVehicle() && target.getVehicleID() === vehicleId) {
        officer.sendClientMessage(Color.error, "Этот игрок уже в вашем транспорте.");
        return;
      }
    } catch {
      officer.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (!arePlayersNearby(officer, target, WHISPER_RADIUS)) {
      officer.sendClientMessage(Color.error, "Игрок слишком далеко.");
      return;
    }

    const seat = findFreePassengerSeat(vehicleId);
    if (seat === null) {
      officer.sendClientMessage(Color.error, "В транспорте нет свободных мест.");
      return;
    }

    const wasCuffed = isCuffed(target);
    if (wasCuffed) {
      releaseCuffForVehiclePut(target);
    }

    try {
      if (target.isInAnyVehicle()) {
        target.removeFromVehicle();
      }

      target.putInVehicle(vehicle, seat);
      target.setCameraBehind();
    } catch {
      if (wasCuffed) {
        scheduleCuffRefreeze(target, 0);
      }
      officer.sendClientMessage(Color.error, "Не удалось посадить игрока в транспорт.");
      return;
    }

    if (wasCuffed) {
      scheduleCuffRefreeze(target, 1000);
    }

    const officerName = playerName(officer);
    const targetName = playerName(target);
    const verb = byGender(
      getAccount(officer)?.gender ?? null,
      "посадил",
      "посадила"
    );

    sendNearby(
      officer,
      CHAT_RADIUS,
      Color.action,
      `${officerName} ${verb} ${targetName} в транспорт.`
    );

    officer.sendClientMessage(Color.info, `Вы посадили ${targetName} в транспорт.`);
    try {
      target.sendClientMessage(Color.info, `${officerName} ${verb} вас в транспорт.`);
    } catch {
      // Уже вышел.
    }
  }
);

function findFreePassengerSeat(vehicleId: number): number | null {
  const taken = new Set<number>();

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (!other.isInAnyVehicle() || other.getVehicleID() !== vehicleId) {
        return;
      }

      const seat = other.getVehicleSeat();
      if (Number.isInteger(seat) && seat >= 0) {
        taken.add(seat);
      }
    } catch {
      // Слот пуст.
    }
  });

  for (const seat of PASSENGER_SEATS) {
    if (!taken.has(seat)) {
      return seat;
    }
  }

  return null;
}
