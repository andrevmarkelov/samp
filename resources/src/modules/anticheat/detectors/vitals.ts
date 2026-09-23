import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";
import { getAccount } from "../../auth/session";
import { AcCode } from "../codes";
import { isCodeEnabled } from "../config";
import { nowMs } from "../math";
import { reportCheat } from "../punish";
import { getPlayerState } from "../state";

export function checkVitals(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned || state.dead || state.spectating) return;

  const now = nowMs();
  let health: number;
  let armour: number;
  try {
    health = player.getHealth();
    armour = player.getArmor();
  } catch {
    return;
  }

  if (now >= state.healthTrustedUntil && isCodeEnabled(AcCode.HealthFoot)) {
    if (health > state.health + 1.5 && health <= 255) {
      reportCheat(
        player,
        AcCode.HealthFoot,
        `hp=${health.toFixed(1)} exp=${state.health.toFixed(1)}`
      );
      return;
    }
  }

  if (now >= state.armourTrustedUntil && isCodeEnabled(AcCode.Armour)) {
    if (armour > state.armour + 1.5) {
      reportCheat(
        player,
        AcCode.Armour,
        `ar=${armour.toFixed(1)} exp=${state.armour.toFixed(1)}`
      );
    }
  }
}

export function checkMoney(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned) return;
  if (!isCodeEnabled(AcCode.Money)) return;
  if (nowMs() < state.moneyTrustedUntil) return;

  const account = getAccount(player);
  if (!account) return;

  let clientMoney: number;
  try {
    clientMoney = player.getMoney();
  } catch {
    return;
  }

  if (clientMoney > account.money + 1) {
    reportCheat(
      player,
      AcCode.Money,
      `client=${clientMoney} server=${account.money}`
    );
    return;
  }

  state.money = account.money;
}
