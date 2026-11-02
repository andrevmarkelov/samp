import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { registerCommand } from "../commands/registry";

type LeaveHandler = (player: Player) => boolean;

const leaveHandlers: LeaveHandler[] = [];
let bound = false;

/** true — игрок на этом мероприятии, выход уже обработан. */
export function onEventLeave(handler: LeaveHandler): void {
  leaveHandlers.push(handler);
}

export function bindEventCommands(): void {
  if (bound) {
    return;
  }
  bound = true;

  registerCommand("leave", "Покинуть мероприятие", (player) => {
    for (const handler of leaveHandlers) {
      if (handler(player)) {
        return;
      }
    }
    try {
      player.sendClientMessage(Color.error, "Вы не на мероприятии.");
    } catch {
      // Игрок уже вышел.
    }
  });
}
