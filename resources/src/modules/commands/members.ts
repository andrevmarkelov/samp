import { Dialog, omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { getAccount } from "../auth/session";
import { getMembership } from "../org";
import { registerCommand } from "./registry";
import { memberStatusSuffix } from "./status-tags";

export const ORG_MEMBERS_DIALOG_ID = 125;

const DIALOG_STYLE_MSGBOX = 0;

registerCommand("members", "Состав организации в сети", (player) => {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership) {
    player.sendClientMessage(Color.error, "Вы не состоите в организации.");
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
  const orgId = membership.org.id;

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
    const otherMembership = otherAccount ? getMembership(otherAccount) : null;
    if (!otherAccount || !otherMembership || otherMembership.org.id !== orgId) {
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
    player.sendClientMessage(Color.error, "В сети нет сотрудников организации.");
    return;
  }

  const lines = rows.map((row) => {
    const phone = row.phone ? ` | тел. ${row.phone}` : "";
    return `[${row.rankId}] ${row.rankTitle} ${row.name}${phone}${row.status}`;
  });

  const body =
    `Организация: ${membership.org.name}\n` +
    `В сети: ${rows.length}\n\n` +
    lines.join("\n");

  try {
    Dialog.show(
      player,
      ORG_MEMBERS_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Организация в сети",
      body,
      "OK",
      ""
    );
  } catch {
    for (const line of lines) {
      player.sendClientMessage(Color.info, line);
    }
  }
});
