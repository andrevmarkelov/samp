import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { clipClientMessage } from "../../shared/nearby";
import { isPlayerActive } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { getMembership } from "./membership";
import { LAW_ORG_IDS } from "./lspd";
import { ORG_FBI_ID } from "./fbi";

const LAW_ORG_SET = new Set<number>(LAW_ORG_IDS);

export function isLawOfficer(player: Player): boolean {
  const account = getAccount(player);
  if (!account || !isAuthenticated(player)) {
    return false;
  }
  const orgId = getMembership(account)?.org.id;
  return orgId !== undefined && LAW_ORG_SET.has(orgId);
}

/** «ФБР» или «Полицейский» (LSPD / областная полиция). */
export function lawOfficerLabel(player: Player): string {
  const account = getAccount(player);
  const orgId = account ? getMembership(account)?.org.id : undefined;
  return orgId === ORG_FBI_ID ? "ФБР" : "Полицейский";
}

/** Сообщение всем онлайн LSPD / областной полиции / FBI. */
export function notifyLawStaff(line: string, color: number = Color.dept): void {
  const text = clipClientMessage(line);
  omp.players.forEach((officer) => {
    if (!isPlayerActive(officer) || !isLawOfficer(officer)) {
      return;
    }
    try {
      if (officer.isNPC()) {
        return;
      }
      officer.sendClientMessage(color, text);
    } catch {
      // Слот пустой.
    }
  });
}
