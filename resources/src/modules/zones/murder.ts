import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount, isAuthenticated } from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { getMembership } from "../org";
import { isLawOfficer, notifyLawStaff } from "../org/law";
import { applyJail, isJailed } from "../prison/sentence";
import { clearPendingHospitalSpawn } from "../spawn";
import { isCaptureCombatKill, isCaptureParticipantOnTurf } from "./capture";
import { districtNameAt } from "./district";

const ALERT_SOUND_ID = 21001;
/** Как у /arrest и сдачи: 1★ = 10 мин. */
const MINUTES_PER_WANTED = 10;

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

  // Полиция / LSPD / FBI — нейтрализация разыскиваемых (не уголовка на офицера).
  if (isLawOfficer(killer)) {
    void tryLawNeutralize(victim, killer);
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

async function tryLawNeutralize(victim: Player, killer: Player): Promise<void> {
  // Свои / другие силовые структуры — не считаем.
  if (isLawOfficer(victim)) {
    return;
  }

  // Бандит на активном капте — не считаем, даже с розыском.
  if (isCaptureParticipantOnTurf(victim)) {
    return;
  }

  const victimAccount = getAccount(victim);
  if (!victimAccount || victimAccount.wantedLevel <= 0) {
    return;
  }

  if (isJailed(victim)) {
    return;
  }

  const wanted = victimAccount.wantedLevel;
  const minutes = Math.max(1, Math.floor(wanted)) * MINUTES_PER_WANTED;
  const district = districtLabelAt(victim);

  clearPendingHospitalSpawn(victim);

  const ok = await applyJail(victim, minutes);
  if (!ok) {
    return;
  }

  setPlayerWantedLevel(victim, 0);

  const killerAccount = getAccount(killer);
  const membership = killerAccount ? getMembership(killerAccount) : null;
  const rankTitle = membership?.rank.title ?? "Офицер";
  const verb = byGender(
    killerAccount?.gender ?? null,
    "нейтрализовал",
    "нейтрализовала"
  );

  notifyLawStaff(
    `${rankTitle} ${playerChatName(killer)} ${verb} преступника в районе: ${district}.`
  );
}

export function startMurderReports(): void {
  omp.on("playerDeath", (player, killer) => {
    onPlayerMurder(player, killer);
  });
}
