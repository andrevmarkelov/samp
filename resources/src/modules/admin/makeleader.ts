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
import { syncOrgVehicleAccess } from "../vehicles/access";
import { refreshCaptureView } from "../zones/capture";
import { hasAdminAccess } from "./session";

export const MAKELEADER_DIALOG_ID = 12;

const DIALOG_STYLE_LIST = 2;
const REMOVE_LABEL = "Снять с лидерки";

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
    return "Игрок не найден.";
  }

  if (!account.passport) {
    return "У игрока нет паспорта.";
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

function orgListLines(): string[] {
  const orgs = allOrganizations();
  return [
    `0. ${REMOVE_LABEL}`,
    ...orgs.map((org, index) => `${index + 1}. ${org.name}`),
  ];
}

function showOrgList(player: Player): boolean {
  try {
    Dialog.show(
      player,
      MAKELEADER_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Лидерка",
      orgListLines().join("\n"),
      "Выбрать",
      "Отмена"
    );
    return true;
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть список.");
    return false;
  }
}

function stripListPrefix(text: string): string {
  return text.replace(/^\d+\.\s*/, "").trim();
}

function pickOrgChoice(
  listItem: number,
  inputText: string
): { orgId: number; orgRank: number } | "remove" | null {
  const orgs = allOrganizations();
  if (listItem === 0) {
    return "remove";
  }

  const byIndex = orgs[listItem - 1];
  if (byIndex) {
    return { orgId: byIndex.id, orgRank: MAX_ORG_RANK };
  }

  const raw = stripListPrefix(inputText).toLowerCase();
  if (!raw || raw === REMOVE_LABEL.toLowerCase()) {
    return raw ? "remove" : null;
  }

  for (const org of orgs) {
    if (raw === org.name.toLowerCase()) {
      return { orgId: org.id, orgRank: MAX_ORG_RANK };
    }
  }

  return null;
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
    admin.sendClientMessage(Color.error, "Не удалось сохранить в базу.");
    return;
  }

  if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
    admin.sendClientMessage(Color.error, "Игрок не найден.");
    return;
  }

  patchAccount(target, { orgId, orgRank });
  applyOrgVisuals(target);
  syncOrgVehicleAccess(target);
  refreshCaptureView(target);

  const tag = playerChatName(target);
  if (orgId === ORG_NONE) {
    admin.sendClientMessage(Color.info, `Вы сняли ${tag} с лидерки.`);
    if (isPlayerActive(target)) {
      target.sendClientMessage(Color.info, "Вас сняли с лидерки.");
    }
    return;
  }

  const orgName = getOrganization(orgId)?.name ?? "организации";
  admin.sendClientMessage(Color.info, `Вы назначили ${tag} лидером: ${orgName}.`);
  if (isPlayerActive(target)) {
    target.sendClientMessage(
      Color.info,
      `Вас назначили лидером организации ${orgName}.`
    );
  }
}

export function bindAdminMakeleader(): void {
  registerCommand(
    "makeleader",
    "Назначить лидера организации",
    (player, args) => {
      if (!hasAdminAccess(player, 5)) {
        return;
      }

      const rawId = args.trim();
      const slot = Number(rawId);
      if (!rawId || !Number.isInteger(slot) || slot < 0) {
        player.sendClientMessage(Color.error, "Использование: /makeleader [id]");
        return;
      }

      const target = findTarget(slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
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
      player.sendClientMessage(Color.error, "Игрок не найден.");
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
