import type { Player } from "@omp-node/core";
import type { Account } from "../auth/session";
import { getAccount } from "../auth/session";
import { Color } from "../../shared/colors";
import { getMembership } from "./membership";

const CIVILIAN_COLOR = 0xffffffff;

export function resolvePlayerSkin(account: Account): number {
  const membership = getMembership(account);
  if (!membership) {
    return account.skin;
  }

  return account.gender === "female"
    ? membership.rank.skins.female
    : membership.rank.skins.male;
}

export function resolveNametagColor(account: Account): number {
  return getMembership(account)?.org.color ?? CIVILIAN_COLOR;
}

export function resolveChatColor(account: Account): number {
  return getMembership(account)?.org.color ?? Color.chat;
}

export function applyOrgVisuals(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  try {
    player.setSkin(resolvePlayerSkin(account));
    player.setColor(resolveNametagColor(account));
  } catch {
    // Слот ещё не в игре.
  }
}
