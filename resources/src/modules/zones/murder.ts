import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { isLawOfficer, notifyLawStaff } from "../org/law";
import { isCaptureCombatKill } from "./capture";
import { districtNameAt } from "./district";

const ALERT_SOUND_ID = 21001;

function isPlayable(player: Player): boolean {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return false;
  }
  try {
    return !player.isNPC();
  } catch {
    return false;
  }
}

function districtLabelAt(player: Player): string {
  try {
    const pos = player.getPos();
    const name = districtNameAt(pos.x, pos.y);
    return name === "Unknown" ? "неизвестный район" : name;
  } catch {
    return "неизвестный район";
  }
}

function playAlertForLaw(): void {
  omp.players.forEach((officer) => {
    if (!isPlayable(officer) || !isLawOfficer(officer)) {
      return;
    }
    try {
      const pos = officer.getPos();
      officer.playGameSound(ALERT_SOUND_ID, pos.x, pos.y, pos.z);
    } catch {
      // Слот пустой.
    }
  });
}

function onPlayerMurder(victim: Player, killer: Player | null | undefined): void {
  if (!killer || !isPlayable(victim) || !isPlayable(killer)) {
    return;
  }

  if (playerId(victim) === playerId(killer)) {
    return;
  }

  // Полиция / LSPD / FBI — служебное применение силы.
  if (isLawOfficer(killer)) {
    return;
  }

  // Капт банд не считаем уголовным убийством.
  if (isCaptureCombatKill(victim, killer)) {
    return;
  }

  const account = getAccount(killer);
  if (!account) {
    return;
  }

  setPlayerWantedLevel(killer, account.wantedLevel + 1);
  notifyLawStaff(
    `Подозреваемый ${playerChatName(killer)} совершил убийство в районе ${districtLabelAt(victim)}`
  );
  playAlertForLaw();
}

export function startMurderReports(): void {
  omp.on("playerDeath", (player, killer) => {
    onPlayerMurder(player, killer);
  });
}
