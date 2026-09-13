import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { saveUserOrg } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import {
  MAX_ORG_RANK,
  ORG_NONE,
  allOrganizations,
  applyOrgVisuals,
  getOrganization,
} from "../org";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

export const MAKELEADER_DIALOG_ID = 12;

const DIALOG_STYLE_LIST = 2;
const REMOVE_LABEL = "Snyat' s liderki";

type PendingMakeleader = {
  slot: number;
  accountId: number;
};

const pendingTarget = new Map<number, PendingMakeleader>();

function clearPending(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    pendingTarget.delete(id);
  }
}

function targetBlocked(target: Player): string | null {
  const account = getAccount(target);
  if (!account) {
    return "Igrok ne nayden.";
  }

  if (!account.passport) {
    return "U igroka net pasporta.";
  }

  return null;
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

function showOrgList(player: Player): boolean {
  const orgs = allOrganizations();
  const body = [...orgs.map((org) => org.name), REMOVE_LABEL].join("\n");

  try {
    Dialog.show(
      player,
      MAKELEADER_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Liderka",
      body,
      "Vybrat'",
      "Otmena"
    );
    return true;
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' spisok.");
    return false;
  }
}

function pickOrgChoice(
  listItem: number,
  inputText: string
): { orgId: number; orgRank: number } | "remove" | null {
  const orgs = allOrganizations();
  const raw = inputText.trim().toLowerCase();

  if (raw === REMOVE_LABEL.toLowerCase()) {
    return "remove";
  }

  for (const org of orgs) {
    if (raw === org.name.toLowerCase()) {
      return { orgId: org.id, orgRank: MAX_ORG_RANK };
    }
  }

  if (listItem === orgs.length) {
    return "remove";
  }

  const org = orgs[listItem];
  if (!org) {
    return null;
  }

  return { orgId: org.id, orgRank: MAX_ORG_RANK };
}

async function applyLeader(
  admin: Player,
  target: Player,
  orgId: number,
  orgRank: number
): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  try {
    await saveUserOrg(account.id, orgId, orgRank);
  } catch {
    admin.sendClientMessage(Color.error, "Ne udalos' sohranit' v bazu.");
    return;
  }

  if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
    admin.sendClientMessage(Color.error, "Igrok ne nayden.");
    return;
  }

  patchAccount(target, { orgId, orgRank });
  applyOrgVisuals(target);

  const tag = playerChatName(target);
  if (orgId === ORG_NONE) {
    admin.sendClientMessage(Color.info, `Vy snyali ${tag} s liderki.`);
    if (isPlayerActive(target)) {
      target.sendClientMessage(Color.info, "Vas snyali s liderki.");
    }
    return;
  }

  const orgName = getOrganization(orgId)?.name ?? "organizacii";
  admin.sendClientMessage(Color.info, `Vy naznachili ${tag} liderom: ${orgName}.`);
  if (isPlayerActive(target)) {
    target.sendClientMessage(
      Color.info,
      `Vas naznachili liderom organizacii ${orgName}.`
    );
  }
}

export function bindAdminMakeleader(): void {
  registerCommand(
    "makeleader",
    "Naznachit' lidera organizacii",
    (player, args) => {
      if (!hasAdminAccess(player, 5)) {
        return;
      }

      const rawId = args.trim();
      const slot = Number(rawId);
      if (!rawId || !Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Ispol'zovanie: /makeleader [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      const error = targetBlocked(target);
      if (error) {
        player.sendClientMessage(Color.error, error);
        return;
      }

      const adminId = playerId(player);
      const account = getAccount(target);
      if (adminId === null || !account) {
        return;
      }

      if (!showOrgList(player)) {
        return;
      }

      pendingTarget.set(adminId, { slot, accountId: account.id });
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== MAKELEADER_DIALOG_ID) {
      return;
    }

    const adminId = playerId(player);
    const pending = adminId === null ? undefined : pendingTarget.get(adminId);
    if (adminId !== null) {
      pendingTarget.delete(adminId);
    }

    if (!hasAdminAccess(player, 5) || Number(response) === 0) {
      return;
    }

    if (!pending) {
      return;
    }

    const target = findTarget(pending.slot);
    const targetAccount = target ? getAccount(target) : null;
    if (!target || !targetAccount || targetAccount.id !== pending.accountId) {
      player.sendClientMessage(Color.error, "Igrok ne nayden.");
      return;
    }

    const blocked = targetBlocked(target);
    if (blocked) {
      player.sendClientMessage(Color.error, blocked);
      return;
    }

    const choice = pickOrgChoice(Number(listItem), String(inputText ?? ""));
    if (!choice) {
      return;
    }

    if (choice === "remove") {
      void applyLeader(player, target, ORG_NONE, 0);
      return;
    }

    void applyLeader(player, target, choice.orgId, choice.orgRank);
  });

  omp.on("playerConnect", (player) => {
    clearPending(player);
  });

  omp.on("playerDisconnect", (player) => {
    clearPending(player);
  });
}
