import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import {
  CHAT_MAX_LENGTH,
  arePlayersNearby,
  clipClientMessage,
  sanitizeChatText,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
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

export const ORG_INVITE_DIALOG_ID = 21;

const DIALOG_STYLE_MSGBOX = 0;
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
  }
}

function expireInvite(slot: number, accountId: number): void {
  const pending = pendingInvite.get(slot);
  if (!pending || pending.targetAccountId !== accountId) {
    return;
  }

  pendingInvite.delete(slot);
  const target = findTarget(slot);
  if (target && getAccount(target)?.id === accountId) {
    tell(target, Color.error, "Priglashenie isteklo.");
  }

  const inviter = findTarget(pending.inviterSlot);
  if (inviter && getAccount(inviter)?.id === pending.inviterAccountId) {
    tell(inviter, Color.error, "Priglashenie isteklo.");
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
    tell(player, Color.error, "Komanda dostupna s 9 ranga organizacii.");
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
    tell(actor, Color.error, "Igrok ne nayden.");
    return null;
  }

  if (samePlayer(actor, target)) {
    tell(actor, Color.error, "Nel'zya primenit' k sebe.");
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
  if (parts.length === 1 && parts[0]) {
    const glued = parts[0].match(/^(\d+)([+-])$/);
    if (!glued?.[1] || !glued[2]) {
      return null;
    }
    const slot = Number(glued[1]);
    if (!Number.isInteger(slot) || slot < 0) {
      return null;
    }
    return { slot, delta: glued[2] === "+" ? 1 : -1 };
  }

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

registerCommand("invite", "Priglasit' v organizaciyu", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const target = requireOtherTarget(player, args, "Ispol'zovanie: /invite [id]");
  if (!target) {
    return;
  }

  const targetAccount = getAccount(target);
  if (!targetAccount) {
    tell(player, Color.error, "Igrok ne nayden.");
    return;
  }

  if (!targetAccount.passport) {
    tell(player, Color.error, "U igroka net pasporta.");
    return;
  }

  if (targetAccount.orgId !== ORG_NONE || getMembership(targetAccount)) {
    tell(player, Color.error, "Igrok uzhe sostoit v organizacii.");
    return;
  }

  if (!arePlayersNearby(player, target, INVITE_RADIUS)) {
    tell(player, Color.error, "Igrok slishkom daleko.");
    return;
  }

  const targetId = playerId(target);
  const actorId = playerId(player);
  if (targetId === null || actorId === null) {
    return;
  }

  if (pendingInvite.has(targetId)) {
    const previous = pendingInvite.get(targetId);
    const oldInviter = previous ? findTarget(previous.inviterSlot) : null;
    clearInvite(target);
    if (oldInviter && previous && getAccount(oldInviter)?.id === previous.inviterAccountId) {
      tell(oldInviter, Color.info, `Priglashenie ${playerChatName(target)} otmeneno.`);
    }
  }

  const rank = getOrgRank(staff.membership.org, MIN_ORG_RANK);
  if (!rank) {
    tell(player, Color.error, "Ne udalos' otpravit' priglashenie.");
    return;
  }

  const body =
    `Vas priglashayut v organizaciyu ${staff.membership.org.name}.\n` +
    `Dolzhnost': ${rank.title}.\n\n` +
    `Prinyat' priglashenie?`;

  try {
    Dialog.show(
      target,
      ORG_INVITE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Priglashenie",
      body,
      "Prinyat'",
      "Otklonit'"
    );
  } catch {
    tell(player, Color.error, "Ne udalos' otpravit' priglashenie.");
    return;
  }

  pendingInvite.set(targetId, {
    inviterSlot: actorId,
    inviterAccountId: staff.account.id,
    targetAccountId: targetAccount.id,
    orgId: staff.membership.org.id,
    orgRank: rank.id,
    timer: setTimeout(() => {
      expireInvite(targetId, targetAccount.id);
    }, INVITE_TTL_MS),
  });

  tell(player, Color.info, `Vy otpravili priglashenie: ${playerChatName(target)}.`);
});

registerCommand("uninvite", "Uvolit' iz organizacii", (player, args) => {
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
    tell(player, Color.error, "Ispol'zovanie: /uninvite [id] [prichina]");
    return;
  }

  const target = requireOtherTarget(player, idPart, "Ispol'zovanie: /uninvite [id] [prichina]");
  if (!target) {
    return;
  }

  const targetAccount = getAccount(target);
  const targetOrg = targetAccount ? getMembership(targetAccount) : null;
  if (!targetAccount || !targetOrg || targetOrg.org.id !== staff.membership.org.id) {
    tell(player, Color.error, "Igrok ne v vashey organizacii.");
    return;
  }

  if (!canManage(targetOrg.rank.id)) {
    tell(player, Color.error, "Nel'zya uvolit' etogo igroka.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.org.id !== staff.membership.org.id) {
      tell(player, Color.error, "Komanda dostupna s 9 ranga organizacii.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveOrg = liveAccount ? getMembership(liveAccount) : null;
    if (!liveAccount || !liveOrg || liveOrg.org.id !== actor.membership.org.id) {
      tell(player, Color.error, "Igrok ne v vashey organizacii.");
      return;
    }

    if (!canManage(liveOrg.rank.id)) {
      tell(player, Color.error, "Nel'zya uvolit' etogo igroka.");
      return;
    }

    const ok = await setOrg(target, ORG_NONE, 0);
    if (!ok) {
      tell(player, Color.error, "Ne udalos' sohranit' v bazu.");
      return;
    }

    const tag = playerChatName(target);
    const orgName = actor.membership.org.name;
    tell(
      player,
      Color.info,
      clipClientMessage(`Vy uvolili ${tag} iz organizacii ${orgName}. Prichina: ${reason}`)
    );
    tell(
      target,
      Color.info,
      clipClientMessage(`Vas uvolili iz organizacii ${orgName}. Prichina: ${reason}`)
    );
  })();
});

registerCommand("rank", "Izmenit' rang v organizacii", (player, args) => {
  const staff = requireStaff(player);
  if (!staff) {
    return;
  }

  const parsed = parseRankDelta(args);
  if (!parsed) {
    tell(player, Color.error, "Ispol'zovanie: /rank [id] [+/-]");
    return;
  }

  const target = findTarget(parsed.slot);
  if (!target) {
    tell(player, Color.error, "Igrok ne nayden.");
    return;
  }

  if (samePlayer(player, target)) {
    tell(player, Color.error, "Nel'zya primenit' k sebe.");
    return;
  }

  const targetAccount = getAccount(target);
  const targetOrg = targetAccount ? getMembership(targetAccount) : null;
  if (!targetAccount || !targetOrg || targetOrg.org.id !== staff.membership.org.id) {
    tell(player, Color.error, "Igrok ne v vashey organizacii.");
    return;
  }

  if (!canManage(targetOrg.rank.id)) {
    tell(player, Color.error, "Nel'zya izmenit' rang etogo igroka.");
    return;
  }

  const next = targetOrg.rank.id + parsed.delta;
  if (next < MIN_ORG_RANK || next > MANAGE_MAX_RANK) {
    tell(player, Color.error, "Rang igroka 1-9.");
    return;
  }

  const nextRank = getOrgRank(targetOrg.org, next);
  if (!nextRank) {
    tell(player, Color.error, "Ne udalos' izmenit' rang.");
    return;
  }

  void (async () => {
    const actor = staffOf(player);
    if (!actor || actor.membership.org.id !== staff.membership.org.id) {
      tell(player, Color.error, "Komanda dostupna s 9 ranga organizacii.");
      return;
    }

    const liveAccount = getAccount(target);
    const liveOrg = liveAccount ? getMembership(liveAccount) : null;
    if (!liveAccount || !liveOrg || liveOrg.org.id !== actor.membership.org.id) {
      tell(player, Color.error, "Igrok ne v vashey organizacii.");
      return;
    }

    if (!canManage(liveOrg.rank.id)) {
      tell(player, Color.error, "Nel'zya izmenit' rang etogo igroka.");
      return;
    }

    const liveNext = liveOrg.rank.id + parsed.delta;
    if (liveNext < MIN_ORG_RANK || liveNext > MANAGE_MAX_RANK) {
      tell(player, Color.error, "Rang igroka 1-9.");
      return;
    }

    const liveNextRank = getOrgRank(liveOrg.org, liveNext);
    if (!liveNextRank) {
      tell(player, Color.error, "Ne udalos' izmenit' rang.");
      return;
    }

    const ok = await setOrg(target, liveOrg.org.id, liveNextRank.id);
    if (!ok) {
      tell(player, Color.error, "Ne udalos' sohranit' v bazu.");
      return;
    }

    const tag = playerChatName(target);
    const verbUp = parsed.delta > 0;
    tell(
      player,
      Color.info,
      verbUp
        ? `Vy povysili ${tag}: ${liveNextRank.title} (${liveNextRank.id}).`
        : `Vy ponizili ${tag}: ${liveNextRank.title} (${liveNextRank.id}).`
    );
    tell(
      target,
      Color.info,
      verbUp
        ? `Vas povysili: ${liveNextRank.title} (${liveNextRank.id}).`
        : `Vas ponizili: ${liveNextRank.title} (${liveNextRank.id}).`
    );
  })();
});

export function bindOrgStaff(): void {
  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== ORG_INVITE_DIALOG_ID) {
      return;
    }

    const targetId = playerId(player);
    const pending = targetId === null ? undefined : pendingInvite.get(targetId);
    if (pending) {
      clearTimeout(pending.timer);
    }
    if (targetId !== null) {
      pendingInvite.delete(targetId);
    }

    if (!pending) {
      tell(player, Color.error, "Priglashenie uzhe neaktual'no.");
      return;
    }

    if (!getAccount(player) || getAccount(player)?.id !== pending.targetAccountId) {
      return;
    }

    const inviter = findTarget(pending.inviterSlot);
    const inviterOk =
      !!inviter && getAccount(inviter)?.id === pending.inviterAccountId && isPlayerActive(inviter);
    const org = getOrganization(pending.orgId);
    const rank = org ? getOrgRank(org, pending.orgRank) : null;
    const targetTag = playerChatName(player);
    const accepted = Number(response) !== 0;
    const verb = byGender(
      getAccount(player)?.gender ?? null,
      accepted ? "prinyal" : "otklonil",
      accepted ? "prinyala" : "otklonila"
    );

    if (!accepted) {
      tell(player, Color.info, "Vy otklonili priglashenie.");
      if (inviterOk && inviter) {
        tell(inviter, Color.info, `${targetTag} ${verb} priglashenie.`);
      }
      return;
    }

    const live = getAccount(player);
    if (!live || !org || !rank) {
      tell(player, Color.error, "Priglashenie uzhe neaktual'no.");
      return;
    }

    if (!live.passport) {
      tell(player, Color.error, "U vas net pasporta.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} ne mozhet vstupit': net pasporta.`);
      }
      return;
    }

    if (live.orgId !== ORG_NONE || getMembership(live)) {
      tell(player, Color.error, "Vy uzhe sostoite v organizacii.");
      if (inviterOk && inviter) {
        tell(inviter, Color.error, `${targetTag} uzhe sostoit v organizacii.`);
      }
      return;
    }

    if (!inviterOk || !inviter) {
      tell(player, Color.error, "Priglashenie uzhe neaktual'no.");
      return;
    }

    if (!arePlayersNearby(player, inviter, INVITE_RADIUS)) {
      tell(player, Color.error, "Vy slishkom daleko ot togo, kto priglasil.");
      tell(inviter, Color.error, `${targetTag} ne smog prinyat': slishkom daleko.`);
      return;
    }

    void (async () => {
      if (!arePlayersNearby(player, inviter, INVITE_RADIUS)) {
        tell(player, Color.error, "Vy slishkom daleko ot togo, kto priglasil.");
        tell(inviter, Color.error, `${targetTag} ne smog prinyat': slishkom daleko.`);
        return;
      }

      const ok = await setOrg(player, pending.orgId, pending.orgRank);
      if (!ok) {
        tell(player, Color.error, "Ne udalos' sohranit' v bazu.");
        if (inviterOk && inviter) {
          tell(inviter, Color.error, "Ne udalos' prinyat' igroka.");
        }
        return;
      }

      tell(
        player,
        Color.info,
        `Vy vstupili v organizaciyu ${org.name}. Dolzhnost': ${rank.title}.`
      );
      if (inviterOk && inviter) {
        tell(inviter, Color.info, `${targetTag} ${verb} priglashenie v ${org.name}.`);
      }
    })();
  });

  omp.on("playerConnect", (player) => {
    clearInvite(player);
  });

  omp.on("playerDisconnect", (player) => {
    clearInvite(player);
  });
}
