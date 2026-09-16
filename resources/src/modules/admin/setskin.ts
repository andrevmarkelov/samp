import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { saveUserSkin } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { applyOrgVisuals, getMembership } from "../org";
import { isMinerOnShift } from "../miner";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 4;
const MIN_SKIN = 1;
const MAX_SKIN = 311;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

function parseArgs(args: string): { slot: number; skin: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const skin = Number(parts[1]);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(skin)) {
    return null;
  }

  if (skin < MIN_SKIN || skin > MAX_SKIN) {
    return null;
  }

  return { slot, skin };
}

function findTarget(slot: number): Player | null {
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

function applyVisibleSkin(target: Player): void {
  if (isMinerOnShift(target)) {
    return;
  }

  const account = getAccount(target);
  if (!account || getMembership(account)) {
    return;
  }

  try {
    if (!target.isSpawned()) {
      return;
    }

    const state = target.getState();
    if (state === PLAYER_STATE_WASTED || state === PLAYER_STATE_SPECTATING) {
      return;
    }
  } catch {
    return;
  }

  applyOrgVisuals(target);
}

export function bindAdminSetskin(): void {
  registerCommand(
    "setskin",
    "Ustanovit' skin igroku",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /setskin [id] [skin] (1-311)"
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

      void applySkin(player, target, parsed.skin);
    },
    true
  );
}

async function applySkin(admin: Player, target: Player, skin: number): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  try {
    await saveUserSkin(account.id, skin);
  } catch {
    admin.sendClientMessage(Color.error, "Ne udalos' sohranit' skin.");
    return;
  }

  if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
    admin.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  patchAccount(target, { skin });
  applyVisibleSkin(target);

  const targetTag = playerChatName(target);
  const adminTag = playerChatName(admin);

  admin.sendClientMessage(
    Color.info,
    `Vy izmenili vneshnost' igroku ${targetTag} na ${skin} skina.`
  );

  if (isPlayerActive(target)) {
    target.sendClientMessage(
      Color.info,
      `Administrator ${adminTag} izmenil vashu vneshnost' na ${skin} skina.`
    );
  }
}
