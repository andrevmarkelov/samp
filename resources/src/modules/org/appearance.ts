import type { Player } from "@omp-node/core";
import type { Account } from "../auth/session";
import { getAccount } from "../auth/session";
import { Color } from "../../shared/colors";
import { applyMaskVisuals, isMasked } from "../mask";
import {
  applyArmyDisguiseVisuals,
  syncArmyDisguise,
} from "./army-disguise";
import { getMembership } from "./membership";

const CIVILIAN_COLOR = 0xffffffff;
const JAIL_SKIN_MALE = 42;
const JAIL_SKIN_FEMALE = 69;

export function resolvePlayerSkin(account: Account): number {
  if (account.jailSeconds > 0) {
    return account.gender === "female" ? JAIL_SKIN_FEMALE : JAIL_SKIN_MALE;
  }

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

  // Маскировка армии (банды): скин/цвет как у армии, членство банды не меняется.
  if (syncArmyDisguise(player)) {
    applyArmyDisguiseVisuals(player, account);
  } else {
    try {
      player.setSkin(resolvePlayerSkin(account));
      player.setColor(resolveNametagColor(account));
    } catch {
      // Слот ещё не в игре.
    }
  }

  // Маска перекрывает цвет (и alpha 0 — скрытие с мини-карты).
  if (isMasked(player)) {
    applyMaskVisuals(player);
  }
}
