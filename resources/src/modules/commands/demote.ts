import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  WHISPER_RADIUS,
  arePlayersNearby,
  clipClientMessage,
  sanitizeChatText,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { byGender } from "../auth/gender";
import { saveUserOrg } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount } from "../auth/session";
import {
  MIN_ORG_RANK,
  ORG_FBI_ID,
  ORG_NONE,
  applyOrgVisuals,
  getMembership,
} from "../org";
import { syncOrgVehicleAccess } from "../vehicles/access";
import { refreshCaptureView } from "../zones/capture";
import { registerCommand } from "./registry";

/** Инспектор FBI и выше. */
const DEMOTE_MIN_RANK = 8;
/** Увольнять можно ранги 1–8 (9+ нельзя). */
const DEMOTE_MAX_TARGET_RANK = 8;

const busy = new Set<number>();

registerCommand(
  "demote",
  "Уволить сотрудника гос. организации (FBI 8+)",
  (player, args) => {
    const actorAccount = getAccount(player);
    const actorMembership = actorAccount ? getMembership(actorAccount) : null;
    if (
      !actorAccount ||
      !actorMembership ||
      actorMembership.org.id !== ORG_FBI_ID ||
      actorMembership.rank.id < DEMOTE_MIN_RANK
    ) {
      player.sendClientMessage(
        Color.error,
        "Команда доступна сотрудникам FBI с 8 ранга."
      );
      return;
    }

    const raw = args.trim();
    const space = raw.indexOf(" ");
    const idPart = (space === -1 ? raw : raw.slice(0, space)).trim();
    const reason = sanitizeChatText(
      space === -1 ? "" : raw.slice(space + 1).trim()
    ).slice(0, CHAT_MAX_LENGTH);

    if (!idPart || !/^\d+$/.test(idPart) || !reason) {
      player.sendClientMessage(
        Color.error,
        "Использование: /demote [id] [причина]"
      );
      return;
    }

    const slot = Number(idPart);
    if (!Number.isInteger(slot) || slot < 0) {
      player.sendClientMessage(
        Color.error,
        "Использование: /demote [id] [причина]"
      );
      return;
    }

    const actorId = playerId(player);
    if (actorId === null) {
      return;
    }

    if (slot === actorId) {
      player.sendClientMessage(Color.error, "Нельзя уволить самого себя.");
      return;
    }

    const target = findTarget(slot);
    if (!target) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    const targetId = playerId(target);
    if (targetId === null) {
      player.sendClientMessage(Color.error, "Игрок не найден.");
      return;
    }

    if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
      player.sendClientMessage(Color.error, "Игрок слишком далеко.");
      return;
    }

    const targetAccount = getAccount(target);
    const targetMembership = targetAccount
      ? getMembership(targetAccount)
      : null;
    if (!targetAccount || !targetMembership) {
      player.sendClientMessage(
        Color.error,
        "Игрок не состоит в государственной организации."
      );
      return;
    }

    if (!targetMembership.org.gov) {
      player.sendClientMessage(
        Color.error,
        "Уволить можно только сотрудника государственной организации."
      );
      return;
    }

    if (targetMembership.org.id === ORG_FBI_ID) {
      player.sendClientMessage(
        Color.error,
        "Нельзя уволить сотрудника FBI."
      );
      return;
    }

    const targetRank = targetMembership.rank.id;
    if (targetRank < MIN_ORG_RANK || targetRank > DEMOTE_MAX_TARGET_RANK) {
      player.sendClientMessage(
        Color.error,
        "Можно уволить только сотрудников 1–8 ранга."
      );
      return;
    }

    if (busy.has(actorId) || busy.has(targetId)) {
      player.sendClientMessage(
        Color.error,
        "Подождите завершения предыдущего увольнения."
      );
      return;
    }

    busy.add(actorId);
    busy.add(targetId);
    void (async () => {
      try {
        if (!isPlayerActive(player) || !isAuthenticated(player)) {
          return;
        }

        const liveActor = getAccount(player);
        const liveActorMembership = liveActor
          ? getMembership(liveActor)
          : null;
        if (
          !liveActor ||
          !liveActorMembership ||
          liveActorMembership.org.id !== ORG_FBI_ID ||
          liveActorMembership.rank.id < DEMOTE_MIN_RANK
        ) {
          tell(player, Color.error, "Команда доступна сотрудникам FBI с 8 ранга.");
          return;
        }

        if (
          !isPlayerActive(target) ||
          !isAuthenticated(target) ||
          !arePlayersNearby(player, target, WHISPER_RADIUS)
        ) {
          tell(player, Color.error, "Игрок слишком далеко.");
          return;
        }

        const liveTarget = getAccount(target);
        const liveTargetMembership = liveTarget
          ? getMembership(liveTarget)
          : null;
        if (
          !liveTarget ||
          !liveTargetMembership ||
          !liveTargetMembership.org.gov ||
          liveTargetMembership.org.id === ORG_FBI_ID ||
          liveTargetMembership.rank.id < MIN_ORG_RANK ||
          liveTargetMembership.rank.id > DEMOTE_MAX_TARGET_RANK
        ) {
          tell(player, Color.error, "Увольнение больше недоступно.");
          return;
        }

        const orgName = liveTargetMembership.org.name;
        const actorTag = playerChatName(player);
        const targetTag = playerChatName(target);
        const verb = byGender(liveActor.gender, "уволил", "уволила");
        const rankTitle = liveActorMembership.rank.title;

        const ok = await clearOrg(target);
        if (!ok) {
          tell(player, Color.error, "Не удалось сохранить в базу.");
          return;
        }

        notifyGovStaff(
          clipClientMessage(
            `${rankTitle} ${actorTag} ${verb} из ${orgName} ${targetTag}. Причина: ${reason}`
          )
        );

        tell(
          player,
          Color.info,
          clipClientMessage(
            `Вы уволили ${targetTag} из ${orgName}. Причина: ${reason}`
          )
        );
        tell(
          target,
          Color.error,
          clipClientMessage(
            `Вас уволили из организации ${orgName}. Причина: ${reason}`
          )
        );
      } finally {
        busy.delete(actorId);
        busy.delete(targetId);
      }
    })();
  }
);

/**
 * Пишет ORG_NONE в БД. Сессию/визуал обновляет только если игрок ещё онлайн.
 * Успех БД = true (даже при дисконнекте цели после save).
 */
async function clearOrg(player: Player): Promise<boolean> {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  const accountId = account.id;

  try {
    await saveUserOrg(accountId, ORG_NONE, 0);
  } catch {
    return false;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== accountId) {
    return true;
  }

  patchAccount(player, { orgId: ORG_NONE, orgRank: 0 });
  applyOrgVisuals(player);
  syncOrgVehicleAccess(player);
  refreshCaptureView(player);
  return true;
}

function notifyGovStaff(line: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !isAuthenticated(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const account = getAccount(other);
    const membership = account ? getMembership(account) : null;
    if (!membership?.org.gov) {
      return;
    }

    tell(other, Color.dept, line);
  });
}

function findTarget(slot: number): Player | null {
  try {
    const target = omp.players.at(slot);
    if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
      return null;
    }

    if (target.isNPC()) {
      return null;
    }

    return target;
  } catch {
    return null;
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (!isPlayerActive(player)) {
      return;
    }
    player.sendClientMessage(color, text);
  } catch {
    // Слот пустой.
  }
}
