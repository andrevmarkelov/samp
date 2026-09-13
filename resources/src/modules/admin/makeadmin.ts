import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { saveAdminAccess } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { promptAdminPasswordSetup, clearAloginDialog } from "./alogin";
import { MAX_ADMIN_LEVEL } from "./catalog";
import { hasAdminAccess } from "./session";

function parseArgs(args: string): { slot: number; level: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const level = Number(parts[1]);
  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }

  if (!Number.isInteger(level) || level < 0 || level > MAX_ADMIN_LEVEL) {
    return null;
  }

  return { slot, level };
}

function findTarget(slot: number) {
  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    return null;
  }

  try {
    if (target.isNPC()) {
      return null;
    }
  } catch {
    return null;
  }

  return target;
}

export function bindAdminMakeadmin(): void {
  registerCommand(
    "makeadmin",
    "Vydat' ili snyat' adminku",
    (player, args) => {
      if (!hasAdminAccess(player, 7)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /makeadmin [id] [lvl] (0-7)"
        );
        return;
      }

      const target = findTarget(parsed.slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      const account = getAccount(target);
      if (!account) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      void grantAdmin(player, target, parsed.level);
    },
    true
  );
}

async function grantAdmin(
  admin: Player,
  target: Player,
  level: number
): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  try {
    await saveAdminAccess(account.id, level);
  } catch {
    admin.sendClientMessage(Color.error, "Ne udalos' sohranit' adminku.");
    return;
  }

  if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
    admin.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  patchAccount(target, { adminLevel: level });
  clearAloginDialog(target);

  const tag = playerChatName(target);
  const same = playerId(admin) === playerId(target);

  if (level < 1) {
    if (!same) {
      admin.sendClientMessage(Color.info, `Vy snyali adminku: ${tag}.`);
    }
    target.sendClientMessage(Color.info, "Vas snyali s administrirovaniya.");
    return;
  }

  if (!same) {
    admin.sendClientMessage(Color.info, `Vy vydali adminku ${tag}: ${level} lvl.`);
  }
  target.sendClientMessage(
    Color.info,
    `Vam vydali administrirovanie. Uroven': ${level}. Pridumayte parol' ot adminki.`
  );
  promptAdminPasswordSetup(target);
}
