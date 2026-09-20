import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { getAccount } from "../auth/session";
import { MAX_ORG_RANK, getMembership } from "../org";
import { registerCommand } from "./registry";

type OnlineLeader = {
  line: string;
  orgName: string;
  slot: number;
};

registerCommand("leaders", "Список лидеров online", (player) => {
  const list: OnlineLeader[] = [];

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

    const account = getAccount(other);
    if (!account) {
      return;
    }

    const membership = getMembership(account);
    if (!membership || membership.rank.id !== MAX_ORG_RANK) {
      return;
    }

    list.push({
      orgName: membership.org.name,
      slot: playerId(other) ?? 0,
      line: `${playerChatName(other)} | ${membership.org.name} | ${membership.rank.title}`,
    });
  });

  list.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.slot - b.slot);

  player.sendClientMessage(Color.info, "Лидеры online:");
  if (list.length === 0) {
    player.sendClientMessage(Color.white, "Сейчас нет лидеров в игре.");
    return;
  }

  for (const row of list) {
    player.sendClientMessage(Color.white, row.line);
  }
});
