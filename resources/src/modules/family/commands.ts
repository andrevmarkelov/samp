import { Dialog, omp, type Player } from "@omp-node/core";
import { Color, chatColorTag } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  CHAT_RADIUS,
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
import { byGender } from "../auth/gender";
import { saveUserFamily } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { memberStatusSuffix } from "../commands/status-tags";
import { getFamily } from "./catalog";
import { getFamilyMembership } from "./membership";
import { getFamilyRank } from "./ranks";
import { syncFamilyTag } from "./tags";
import {
  FAMILY_MANAGE_MAX_RANK,
  FAMILY_NONE,
  FAMILY_STAFF_MIN_RANK,
  MIN_FAMILY_RANK,
} from "./types";

/** @deprecated Диалог больше не используется — приглашение через Y/N. */
export const FAMILY_INVITE_DIALOG_ID = 112;
export const FAMILY_MEMBERS_DIALOG_ID = 123;

const DIALOG_STYLE_MSGBOX = 0;
const KEY_YES = 65536;
const KEY_NO = 131072;
const INVITE_TTL_MS = 60_000;
const INVITE_RADIUS = 10;
const BUBBLE_MS = 3000;

type PendingInvite = {
  inviterSlot: number;
  inviterAccountId: number;
  targetAccountId: number;
  familyId: number;
  familyRank: number;
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
    releaseYnOffer(id, "finvite");
  }
}

function expireInvite(slot: number, accountId: number): void {
  const pending = pendingInvite.get(slot);
  if (!pending || pending.targetAccountId !== accountId) {
    return;
  }

  clearTimeout(pending.timer);
  pendingInvite.delete(slot);
  releaseYnOffer(slot, "finvite");

  const target = findTarget(slot);
  if (target && getAccount(target)?.id === accountId) {
    tell(target, Color.error, "Приглашение в семью истекло.");
  }

  const inviter = findTarget(pending.inviterSlot);
  if (inviter && getAccount(inviter)?.id === pending.inviterAccountId) {
    tell(inviter, Color.error, "Приглашение в семью истекло.");
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

function samePlayer(a: Player, b: Player): boolean {
  const left = playerId(a);
  const right = playerId(b);
  return left !== null && left === right;
}

function staffOf(player: Player) {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || membership.rank.id < FAMILY_STAFF_MIN_RANK) {
    return null;
  }
  return { account, membership };
}

function requireStaff(player: Player) {
  const staff = staffOf(player);
  if (!staff) {
    tell(player, Color.error, "Команда доступна с 9 ранга семьи.");
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
  return targetRank >= MIN_FAMILY_RANK && targetRank <= FAMILY_MANAGE_MAX_RANK;
}

async function setFamily(
  player: Player,
  familyId: number,
  familyRank: number
): Promise<boolean> {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  try {
    await saveUserFamily(account.id, familyId, familyRank);
  } catch {
    return false;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    return false;
  }

  patchAccount(player, { familyId, familyRank });
  syncFamilyTag(player);
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

/** Уведомление всем онлайн-членам семьи в стиле /fam. */
function broadcastFamilyNotice(
  familyId: number,
  familyName: string,
  actor: Player,
  message: string
): void {
  const membership = getAccount(actor) ? getFamilyMembership(getAccount(actor)!) : null;
  const rankId = membership?.rank.id ?? 0;
  const rankTitle = membership?.rank.title ?? "—";

  const line = clipClientMessage(
    `[Семья] [${familyName}] [${rankId}] ${rankTitle} ${playerChatName(actor)}${chatColorTag(Color.white)}: ${message}`
  );

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const otherAccount = getAccount(other);
    if (!otherAccount || otherAccount.familyId !== familyId) {
      return;
    }

    try {
      other.sendClientMessage(Color.familyChat, line);
    } catch {
      // Слот пустой.
    }
  });
}

registerCommand("fmembers", "Состав семьи в сети", (player) => {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  type MemberRow = {
    rankId: number;
    rankTitle: string;
    name: string;
    phone: string | null;
    status: string;
  };

  const rows: MemberRow[] = [];

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const otherAccount = getAccount(other);
    const otherMembership = otherAccount ? getFamilyMembership(otherAccount) : null;
    if (
      !otherAccount ||
      !otherMembership ||
      otherMembership.family.id !== membership.family.id
    ) {
      return;
    }

    rows.push({
      rankId: otherMembership.rank.id,
      rankTitle: otherMembership.rank.title,
      name: playerChatName(other),
      phone: otherAccount.phone,
      status: memberStatusSuffix(other),
    });
  });

  rows.sort((a, b) => b.rankId - a.rankId || a.name.localeCompare(b.name));

  if (rows.length === 0) {
    tell(player, Color.error, "В сети нет членов семьи.");
    return;
  }

  const lines = rows.map((row) => {
    const phone = row.phone ? ` | тел. ${row.phone}` : "";
    return `[${row.rankId}] ${row.rankTitle} ${row.name}${phone}${row.status}`;
  });

  const body =
    `Семья: ${membership.family.name}\n` +
    `В сети: ${rows.length}\n\n` +
    lines.join("\n");

  try {
    Dialog.show(
      player,
      FAMILY_MEMBERS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Семья в сети",
      body,
      "OK",
      ""
    );
  } catch {
    for (const line of lines) {
      tell(player, Color.info, line);
    }
  }
});

registerCommand("fam", "Рация семьи", (player, args) => {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    tell(player, Color.error, "Использование: /fam [текст]");
    return;
  }

  const line = clipClientMessage(
    `[Семья] [${membership.family.name}] [${membership.rank.id}] ${membership.rank.title} ${playerChatName(player)}${chatColorTag(Color.white)}: ${text}`
  );
  const familyId = membership.family.id;

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const otherAccount = getAccount(other);
    if (!otherAccount || otherAccount.familyId !== familyId) {
      return;
    }

    try {
      other.sendClientMessage(Color.familyChat, line);
    } catch {
      // Слот пустой.
    }
  });

  try {
    player.setChatBubble("Сообщение семье.", Color.familyChat, CHAT_RADIUS, BUBBLE_MS);
  } catch {
    // Пузырь не обязателен.
  }
});

registerCommand("finvite", "Пригласить в семью", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const target = requireOtherTarget(player, args, "Использование: /finvite [id]");
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

  if (getFamilyMembership(targetAccount)) {
    tell(player, Color.error, "Игрок уже состоит в семье.");
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

  if (!claimYnOffer(targetId, "finvite")) {
    tell(player, Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  const rank = getFamilyRank(MIN_FAMILY_RANK);
  if (!rank) {
    releaseYnOffer(targetId, "finvite");
    tell(player, Color.error, "Не удалось отправить приглашение.");
    return;
  }

  pendingInvite.set(targetId, {
    inviterSlot: actorId,
    inviterAccountId: staff.account.id,
    targetAccountId: targetAccount.id,
    familyId: staff.membership.family.id,
    familyRank: rank.id,
    expiresAt: Date.now() + INVITE_TTL_MS,
    timer: setTimeout(() => {
      expireInvite(targetId, targetAccount.id);
    }, INVITE_TTL_MS),
  });

  tell(player, Color.info, `Вы отправили приглашение: ${playerChatName(target)}.`);
  tell(
    target,
    Color.white,
    `${playerChatName(player)} приглашает вас в семью ${staff.membership.family.name} (${rank.title}).`
  );
  tell(
    target,
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы принять или {FF6600}N {FFFFFF}для отказа"
  );
});

registerCommand("funinvite", "Исключить из семьи", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const raw = args.trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const idPart = parts[0] ?? "";
  const reason = sanitizeChatText(parts.slice(1).join(" ")).slice(0, CHAT_MAX_LENGTH);

  if (!idPart) {
    tell(player, Color.error, "Использование: /funinvite [id] [причина]");
    return;
  }

  const target = requireOtherTarget(player, idPart, "Использование: /funinvite [id] [причина]");
  if (!target) {
    return;
  }

  const targetAccount = getAccount(target);
  const targetFamily = targetAccount ? getFamilyMembership(targetAccount) : null;
  if (
    !targetAccount ||
    !targetFamily ||
    targetFamily.family.id !== staff.membership.family.id
  ) {
    tell(player, Color.error, "Игрок не в вашей семье.");
    return;
  }

  if (targetFamily.family.ownerId === targetAccount.id) {
    tell(player, Color.error, "Нельзя исключить владельца семьи.");
    return;
  }

  if (!canManage(targetFamily.rank.id)) {
    tell(player, Color.error, "Нельзя исключить этого игрока.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.family.id !== staff.membership.family.id) {
      tell(player, Color.error, "Команда доступна с 9 ранга семьи.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveFamily = liveAccount ? getFamilyMembership(liveAccount) : null;
    if (
      !liveAccount ||
      !liveFamily ||
      liveFamily.family.id !== actor.membership.family.id
    ) {
      tell(player, Color.error, "Игрок не в вашей семье.");
      return;
    }

    if (liveFamily.family.ownerId === liveAccount.id || !canManage(liveFamily.rank.id)) {
      tell(player, Color.error, "Нельзя исключить этого игрока.");
      return;
    }

    const tag = playerChatName(target);
    const familyId = actor.membership.family.id;
    const familyName = actor.membership.family.name;

    const ok = await setFamily(target, FAMILY_NONE, 0);
    if (!ok) {
      tell(player, Color.error, "Не удалось сохранить в базу.");
      return;
    }

    const reasonText = reason ? ` Причина: ${reason}` : "";
    tell(target, Color.info, clipClientMessage(`Вас исключили из семьи ${familyName}.${reasonText}`));

    broadcastFamilyNotice(
      familyId,
      familyName,
      player,
      `уволил ${tag}.${reasonText}`
    );
  })();
});

registerCommand("frang", "Изменить ранг в семье", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const parsed = parseRankDelta(args);
  if (!parsed) {
    tell(player, Color.error, "Использование: /frang [id] [+/-]");
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
  const targetFamily = targetAccount ? getFamilyMembership(targetAccount) : null;
  if (
    !targetAccount ||
    !targetFamily ||
    targetFamily.family.id !== staff.membership.family.id
  ) {
    tell(player, Color.error, "Игрок не в вашей семье.");
    return;
  }

  if (targetFamily.family.ownerId === targetAccount.id) {
    tell(player, Color.error, "Нельзя менять ранг владельца.");
    return;
  }

  if (!canManage(targetFamily.rank.id)) {
    tell(player, Color.error, "Нельзя изменить ранг этого игрока.");
    return;
  }

  const next = targetFamily.rank.id + parsed.delta;
  if (next < MIN_FAMILY_RANK || next > FAMILY_MANAGE_MAX_RANK) {
    tell(player, Color.error, "Ранг игрока 1-9.");
    return;
  }

  if (!getFamilyRank(next)) {
    tell(player, Color.error, "Не удалось изменить ранг.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.family.id !== staff.membership.family.id) {
      tell(player, Color.error, "Команда доступна с 9 ранга семьи.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveFamily = liveAccount ? getFamilyMembership(liveAccount) : null;
    if (
      !liveAccount ||
      !liveFamily ||
      liveFamily.family.id !== actor.membership.family.id
    ) {
      tell(player, Color.error, "Игрок не в вашей семье.");
      return;
    }

    if (
      liveFamily.family.ownerId === liveAccount.id ||
      !canManage(liveFamily.rank.id)
    ) {
      tell(player, Color.error, "Нельзя изменить ранг этого игрока.");
      return;
    }

    const liveNext = liveFamily.rank.id + parsed.delta;
    if (liveNext < MIN_FAMILY_RANK || liveNext > FAMILY_MANAGE_MAX_RANK) {
      tell(player, Color.error, "Ранг игрока 1-9.");
      return;
    }

    const liveNextRank = getFamilyRank(liveNext);
    if (!liveNextRank) {
      tell(player, Color.error, "Не удалось изменить ранг.");
      return;
    }

    const ok = await setFamily(target, liveFamily.family.id, liveNextRank.id);
    if (!ok) {
      tell(player, Color.error, "Не удалось сохранить в базу.");
      return;
    }

    const tag = playerChatName(target);
    const verbUp = parsed.delta > 0;
    const action = verbUp
      ? `повысил ${tag} до ${liveNextRank.title} (${liveNextRank.id})`
      : `понизил ${tag} до ${liveNextRank.title} (${liveNextRank.id})`;

    tell(
      target,
      Color.info,
      verbUp
        ? `Вас повысили в семье: ${liveNextRank.title} (${liveNextRank.id}).`
        : `Вас понизили в семье: ${liveNextRank.title} (${liveNextRank.id}).`
    );

    broadcastFamilyNotice(
      actor.membership.family.id,
      actor.membership.family.name,
      player,
      action
    );
  })();
});

export function bindFamilyCommands(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const targetId = playerId(player);
    if (targetId === null || getYnOfferKind(targetId) !== "finvite") {
      return;
    }

    const pending = pendingInvite.get(targetId);
    if (!pending) {
      releaseYnOffer(targetId, "finvite");
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
      releaseYnOffer(targetId, "finvite");
      return;
    }

    const inviter = findTarget(pending.inviterSlot);
    const inviterOk =
      !!inviter && getAccount(inviter)?.id === pending.inviterAccountId && isPlayerActive(inviter);
    const family = getFamily(pending.familyId);
    const rank = getFamilyRank(pending.familyRank);
    const targetTag = playerChatName(player);
    const accepted = (pressed & KEY_YES) !== 0;
    const verb = byGender(
      getAccount(player)?.gender ?? null,
      accepted ? "принял" : "отклонил",
      accepted ? "приняла" : "отклонила"
    );

    if (!accepted) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.info, "Вы отклонили приглашение в семью.");
      if (inviterOk && inviter) {
        tell(inviter, Color.info, `${targetTag} ${verb} приглашение в семью.`);
      }
      return;
    }

    const live = getAccount(player);
    if (!live || !family || !rank) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    if (!live.passport) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.error, "У вас нет паспорта.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} не может вступить: нет паспорта.`);
      }
      return;
    }

    if (getFamilyMembership(live)) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.error, "Вы уже состояте в семье.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} уже состоит в семье.`);
      }
      return;
    }

    if (!inviterOk || !inviter) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    const inviterStaff = staffOf(inviter);
    if (
      !inviterStaff ||
      inviterStaff.membership.family.id !== pending.familyId
    ) {
      releaseYnOffer(targetId, "finvite");
      tell(player, Color.error, "Приглашение уже неактуально.");
      return;
    }

    if (!arePlayersNearby(player, inviter, INVITE_RADIUS)) {
      releaseYnOffer(targetId, "finvite");
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

        if (!getFamily(pending.familyId)) {
          tell(player, Color.error, "Семья больше не существует.");
          return;
        }

        const liveInviterStaff = staffOf(inviter);
        if (
          !liveInviterStaff ||
          liveInviterStaff.membership.family.id !== pending.familyId
        ) {
          tell(player, Color.error, "Приглашение уже неактуально.");
          return;
        }

        const liveAgain = getAccount(player);
        if (!liveAgain || liveAgain.id !== pending.targetAccountId) {
          return;
        }
        if (getFamilyMembership(liveAgain)) {
          tell(player, Color.error, "Вы уже состояте в семье.");
          return;
        }

        const ok = await setFamily(player, pending.familyId, pending.familyRank);
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
          `Вы вступили в семью ${family.name}. Должность: ${rank.title}.`
        );

        if (isPlayerActive(inviter) && getAccount(inviter)?.id === pending.inviterAccountId) {
          broadcastFamilyNotice(
            pending.familyId,
            family.name,
            inviter,
            `пригласил ${targetTag} в семью`
          );
        }
      } finally {
        releaseYnOffer(targetId, "finvite");
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
        releaseYnOffer(targetSlot, "finvite");
        if (target) {
          tell(target, Color.error, "Приглашение в семью отменено.");
        }
      }
    }
  });
}
