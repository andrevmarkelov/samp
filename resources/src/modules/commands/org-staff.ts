import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  arePlayersNearby,
  clipClientMessage,
  sanitizeChatText,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { saveUserOrg } from "../auth/repository";
import { byGender } from "../auth/gender";
import { getAccount, patchAccount } from "../auth/session";
import {
  MIN_ORG_RANK,
  ORG_NONE,
  applyOrgVisuals,
  getMembership,
  getOrgRank,
  getOrganization,
} from "../org";
import { syncOrgVehicleAccess } from "../vehicles/access";
import { refreshCaptureView } from "../zones/capture";
import { registerCommand } from "./registry";

/** @deprecated Диалог больше не используется — приглашение через Y/N. */
export const ORG_INVITE_DIALOG_ID = 21;

const KEY_YES = 65536;
const KEY_NO = 131072;
const STAFF_MIN_RANK = 9;
const MANAGE_MAX_RANK = 9;
const INVITE_TTL_MS = 60_000;
const INVITE_RADIUS = 10;

type PendingInvite = {
  inviterSlot: number;
  inviterAccountId: number;
  targetAccountId: number;
  orgId: number;
  orgRank: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const pendingInvite = new Map<number, PendingInvite>();

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}

function clearInvite(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const pending = pendingInvite.get(id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingInvite.delete(id);
    releaseYnOffer(id, "invite");
  }
}

function expireInvite(slot: number, accountId: number): void {
  const pending = pendingInvite.get(slot);
  if (!pending || pending.targetAccountId !== accountId) {
    return;
  }

  clearTimeout(pending.timer);
  pendingInvite.delete(slot);
  releaseYnOffer(slot, "invite");

  const target = findTarget(slot);
  if (target && getAccount(target)?.id === accountId) {
    tell(target, Color.error, "Приглашение истекло.");
  }

  const inviter = findTarget(pending.inviterSlot);
  if (inviter && getAccount(inviter)?.id === pending.inviterAccountId) {
    tell(inviter, Color.error, "Приглашение истекло.");
  }
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

  return getAccount(target) ? target : null;
}

function parseSlot(raw: string): number | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const slot = Number(text);
  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }
  return slot;
}

function staffOf(player: Player) {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership || membership.rank.id < STAFF_MIN_RANK) {
    return null;
  }
  return { account, membership };
}

function samePlayer(a: Player, b: Player): boolean {
  const left = playerId(a);
  const right = playerId(b);
  return left !== null && left === right;
}

function requireStaff(player: Player) {
  const staff = staffOf(player);
  if (!staff) {
    tell(player, Color.error, "Команда доступна с 9 ранга организации.");
    return null;
  }
  return staff;
}

function requireOtherTarget(actor: Player, args: string, usage: string): Player | null {
  const slot = parseSlot(args.trim().split(/\s+/).filter(Boolean)[0] ?? "");
  if (slot === null) {
    tell(actor, Color.error, usage);
    return null;
  }

  const target = findTarget(slot);
  if (!target) {
    tell(actor, Color.error, "Игрок не найден.");
    return null;
  }

  if (samePlayer(actor, target)) {
    tell(actor, Color.error, "Нельзя применить к себе.");
    return null;
  }

  return target;
}

function canManage(targetRank: number): boolean {
  return targetRank >= MIN_ORG_RANK && targetRank <= MANAGE_MAX_RANK;
}

async function setOrg(player: Player, orgId: number, orgRank: number): Promise<boolean> {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  try {
    await saveUserOrg(account.id, orgId, orgRank);
  } catch {
    return false;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return false;
  }

  patchAccount(player, { orgId, orgRank });
  applyOrgVisuals(player);
  syncOrgVehicleAccess(player);
  refreshCaptureView(player);
  return true;
}

function parseRankDelta(args: string): { slot: number; delta: 1 | -1 } | null {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = parseSlot(parts[0]);
  if (slot === null) {
    return null;
  }

  if (parts[1] === "+") {
    return { slot, delta: 1 };
  }
  if (parts[1] === "-") {
    return { slot, delta: -1 };
  }
  return null;
}

registerCommand("invite", "Пригласить в организацию", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const target = requireOtherTarget(player, args, "Использование: /invite [id]");
  if (!target) {
    return;
  }

  const targetAccount = getAccount(target);
  if (!targetAccount) {
    tell(player, Color.error, "Игрок не найден.");
    return;
  }

  if (!targetAccount.passport) {
    tell(player, Color.error, "У игрока нет паспорта.");
    return;
  }

  if (targetAccount.orgId !== ORG_NONE || getMembership(targetAccount)) {
    tell(player, Color.error, "Игрок уже состоит в организации.");
    return;
  }

  if (!arePlayersNearby(player, target, INVITE_RADIUS)) {
    tell(player, Color.error, "Игрок слишком далеко.");
    return;
  }

  const targetId = playerId(target);
  const actorId = playerId(player);
  if (targetId === null || actorId === null) {
    return;
  }

  if (!claimYnOffer(targetId, "invite")) {
    tell(player, Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  const rank = getOrgRank(staff.membership.org, MIN_ORG_RANK);
  if (!rank) {
    releaseYnOffer(targetId, "invite");
    tell(player, Color.error, "Не удалось отправить приглашение.");
    return;
  }

  pendingInvite.set(targetId, {
    inviterSlot: actorId,
    inviterAccountId: staff.account.id,
    targetAccountId: targetAccount.id,
    orgId: staff.membership.org.id,
    orgRank: rank.id,
    expiresAt: Date.now() + INVITE_TTL_MS,
    timer: setTimeout(() => {
      expireInvite(targetId, targetAccount.id);
    }, INVITE_TTL_MS),
  });

  tell(player, Color.info, `Вы отправили приглашение: ${playerChatName(target)}.`);
  tell(
    target,
    Color.white,
    `${playerChatName(player)} приглашает вас в организацию ${staff.membership.org.name} (${rank.title}).`
  );
  tell(
    target,
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы принять или {FF6600}N {FFFFFF}для отказа"
  );
});

registerCommand("uninvite", "Уволить из организации", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const raw = args.trim();
  const space = raw.indexOf(" ");
  const idPart = (space === -1 ? raw : raw.slice(0, space)).trim();
  const reason = sanitizeChatText(space === -1 ? "" : raw.slice(space + 1).trim()).slice(
    0,
    CHAT_MAX_LENGTH
  );

  if (!idPart || !reason) {
    tell(player, Color.error, "Использование: /uninvite [id] [причина]");
    return;
  }

  const target = requireOtherTarget(player, idPart, "Использование: /uninvite [id] [причина]");
  if (!target) {
    return;
  }

  const targetAccount = getAccount(target);
  const targetOrg = targetAccount ? getMembership(targetAccount) : null;
  if (!targetAccount || !targetOrg || targetOrg.org.id !== staff.membership.org.id) {
    tell(player, Color.error, "Игрок не в вашей организации.");
    return;
  }

  if (!canManage(targetOrg.rank.id)) {
    tell(player, Color.error, "Нельзя уволить этого игрока.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.org.id !== staff.membership.org.id) {
      tell(player, Color.error, "Команда доступна с 9 ранга организации.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveOrg = liveAccount ? getMembership(liveAccount) : null;
    if (!liveAccount || !liveOrg || liveOrg.org.id !== actor.membership.org.id) {
      tell(player, Color.error, "Игрок не в вашей организации.");
      return;
    }

    if (!canManage(liveOrg.rank.id)) {
      tell(player, Color.error, "Нельзя уволить этого игрока.");
      return;
    }

    const ok = await setOrg(target, ORG_NONE, 0);
    if (!ok) {
      tell(player, Color.error, "Не удалось сохранить в базу.");
      return;
    }

    const tag = playerChatName(target);
    const orgName = actor.membership.org.name;
    tell(
      player,
      Color.info,
      clipClientMessage(`Вы уволили ${tag} из организации ${orgName}. Причина: ${reason}`)
    );
    tell(
      target,
      Color.info,
      clipClientMessage(`Вас уволили из организации ${orgName}. Причина: ${reason}`)
    );
  })();
});

registerCommand("rang", "Изменить ранг в организации", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const parsed = parseRankDelta(args);
  if (!parsed) {
    tell(player, Color.error, "Использование: /rang [id] [+/-]");
    return;
  }

  const target = findTarget(parsed.slot);
  if (!target) {
    tell(player, Color.error, "Игрок не найден.");
    return;
  }

  if (samePlayer(player, target)) {
    tell(player, Color.error, "Нельзя применить к себе.");
    return;
  }

  const targetAccount = getAccount(target);
  const targetOrg = targetAccount ? getMembership(targetAccount) : null;
  if (!targetAccount || !targetOrg || targetOrg.org.id !== staff.membership.org.id) {
    tell(player, Color.error, "Игрок не в вашей организации.");
    return;
  }

  if (!canManage(targetOrg.rank.id)) {
    tell(player, Color.error, "Нельзя изменить ранг этого игрока.");
    return;
  }

  const next = targetOrg.rank.id + parsed.delta;
  if (next < MIN_ORG_RANK || next > MANAGE_MAX_RANK) {
    tell(player, Color.error, "Ранг игрока 1-9.");
    return;
  }

  const nextRank = getOrgRank(targetOrg.org, next);
  if (!nextRank) {
    tell(player, Color.error, "Не удалось изменить ранг.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.org.id !== staff.membership.org.id) {
      tell(player, Color.error, "Команда доступна с 9 ранга организации.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveOrg = liveAccount ? getMembership(liveAccount) : null;
    if (!liveAccount || !liveOrg || liveOrg.org.id !== actor.membership.org.id) {
      tell(player, Color.error, "Игрок не в вашей организации.");
      return;
    }

    if (!canManage(liveOrg.rank.id)) {
      tell(player, Color.error, "Нельзя изменить ранг этого игрока.");
      return;
    }

    const liveNext = liveOrg.rank.id + parsed.delta;
    if (liveNext < MIN_ORG_RANK || liveNext > MANAGE_MAX_RANK) {
      tell(player, Color.error, "Ранг игрока 1-9.");
      return;
    }

    const liveNextRank = getOrgRank(liveOrg.org, liveNext);
    if (!liveNextRank) {
      tell(player, Color.error, "Не удалось изменить ранг.");
      return;
    }

    const ok = await setOrg(target, liveOrg.org.id, liveNextRank.id);
    if (!ok) {
      tell(player, Color.error, "Не удалось сохранить в базу.");
      return;
    }

    const tag = playerChatName(target);
    const verbUp = parsed.delta > 0;
    tell(
      player,
      Color.info,
      verbUp
        ? `Вы повысили ${tag}: ${liveNextRank.title} (${liveNextRank.id}).`
        : `Вы понизили ${tag}: ${liveNextRank.title} (${liveNextRank.id}).`
    );
    tell(
      target,
      Color.info,
      verbUp
        ? `Вас повысили: ${liveNextRank.title} (${liveNextRank.id}).`
        : `Вас понизили: ${liveNextRank.title} (${liveNextRank.id}).`
    );
  })();
});

export function bindOrgStaff(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const targetId = playerId(player);
    if (targetId === null || getYnOfferKind(targetId) !== "invite") {
      return;
    }

    const pending = pendingInvite.get(targetId);
    if (!pending) {
      releaseYnOffer(targetId, "invite");
      return;
    }

    if (Date.now() > pending.expiresAt) {
      expireInvite(targetId, pending.targetAccountId);
      return;
    }

    // Снимаем pending сразу (анти-даблклик), yn-слот держим до конца обработки.
    clearTimeout(pending.timer);
    pendingInvite.delete(targetId);

    if (!getAccount(player) || getAccount(player)?.id !== pending.targetAccountId) {
      releaseYnOffer(targetId, "invite");
      return;
    }

    const inviter = findTarget(pending.inviterSlot);
    const inviterOk =
      !!inviter && getAccount(inviter)?.id === pending.inviterAccountId && isPlayerActive(inviter);
    const org = getOrganization(pending.orgId);
    const rank = org ? getOrgRank(org, pending.orgRank) : null;
    const targetTag = playerChatName(player);
    const accepted = (pressed & KEY_YES) !== 0;
    const verb = byGender(
      getAccount(player)?.gender ?? null,
      accepted ? "принял" : "отклонил",
      accepted ? "приняла" : "отклонила"
    );

    if (!accepted) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.info, "Вы отклонили приглашение.");
      if (inviterOk && inviter) {
        tell(inviter, Color.info, `${targetTag} ${verb} приглашение.`);
      }
      return;
    }

    const live = getAccount(player);
    if (!live || !org || !rank) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    if (!live.passport) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "У вас нет паспорта.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} не может вступить: нет паспорта.`);
      }
      return;
    }

    if (live.orgId !== ORG_NONE || getMembership(live)) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "Вы уже состоите в организации.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} уже состоит в организации.`);
      }
      return;
    }

    if (!inviterOk || !inviter) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    const liveStaff = staffOf(inviter);
    if (!liveStaff || liveStaff.membership.org.id !== pending.orgId) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    if (!arePlayersNearby(player, inviter, INVITE_RADIUS)) {
      releaseYnOffer(targetId, "invite");
      tell(player, Color.error, "Вы слишком далеко от того, кто пригласил.");
      tell(inviter, Color.error, `${targetTag} не смог принять: слишком далеко.`);
      return;
    }

    void (async () => {
      try {
        if (!arePlayersNearby(player, inviter, INVITE_RADIUS)) {
          tell(player, Color.error, "Вы слишком далеко от того, кто пригласил.");
          tell(inviter, Color.error, `${targetTag} не смог принять: слишком далеко.`);
          return;
        }

        const again = getAccount(player);
        if (
          !again ||
          again.id !== pending.targetAccountId ||
          again.orgId !== ORG_NONE ||
          getMembership(again)
        ) {
          tell(player, Color.error, "Вы уже состоите в организации.");
          return;
        }

        const stillStaff = staffOf(inviter);
        if (!stillStaff || stillStaff.membership.org.id !== pending.orgId) {
          tell(player, Color.error, "Приглашение уже неактуально.");
          return;
        }

        const ok = await setOrg(player, pending.orgId, pending.orgRank);
        if (!ok) {
          tell(player, Color.error, "Не удалось сохранить в базу.");
          if (inviterOk && inviter) {
            tell(inviter, Color.error, "Не удалось принять игрока.");
          }
          return;
        }

        tell(
          player,
          Color.info,
          `Вы вступили в организацию ${org.name}. Должность: ${rank.title}.`
        );
        if (inviterOk && inviter) {
          tell(inviter, Color.info, `${targetTag} ${verb} приглашение в ${org.name}.`);
        }
      } finally {
        releaseYnOffer(targetId, "invite");
      }
    })();
  });

  omp.on("playerConnect", (player) => {
    clearInvite(player);
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    clearInvite(player);
    if (slot === null) {
      return;
    }

    for (const [targetSlot, offer] of pendingInvite) {
      if (offer.inviterSlot === slot) {
        const target = findTarget(targetSlot);
        clearTimeout(offer.timer);
        pendingInvite.delete(targetSlot);
        releaseYnOffer(targetSlot, "invite");
        if (target) {
          tell(target, Color.error, "Приглашение отменено.");
        }
      }
    }
  });
}
