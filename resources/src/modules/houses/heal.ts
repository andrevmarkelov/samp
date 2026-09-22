import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { applyHealth, getAccount, MAX_HEALTH, patchAccount } from "../auth/session";
import { findOwnedHouseAtInterior } from "./interior";

export function tryHealInHouse(player: Player): void {
  const house = findOwnedHouseAtInterior(player);
  if (!house) {
    player.sendClientMessage(Color.error, "Команда доступна только внутри вашего дома.");
    return;
  }

  if (!house.hasMedkit) {
    player.sendClientMessage(Color.error, "В доме нет аптечки.");
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  patchAccount(player, { health: MAX_HEALTH });
  applyHealth(player, MAX_HEALTH);
  player.sendClientMessage(Color.info, "Вы восстановили здоровье.");
}
