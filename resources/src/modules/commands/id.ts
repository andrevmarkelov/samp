import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { registerCommand } from "./registry";

const MAX_RESULTS = 10;

registerCommand(
  "id",
  "Поиск игроков онлайн по ID или части ника",
  (player, args) => {
    if (!isAuthenticated(player)) {
      player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
      return;
    }

    const query = args.trim();
    if (!query) {
      player.sendClientMessage(
        Color.error,
        "Использование: /id [ID или часть ника]"
      );
      return;
    }

    const searchId = /^\d+$/.test(query) ? Number(query) : null;
    const needle = query.toLowerCase();

    player.sendClientMessage(
      Color.white,
      "Игроки, найденные по вашему запросу:"
    );

    let count = 0;
    omp.players.forEach((other) => {
      if (count >= MAX_RESULTS) {
        return;
      }

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

      const slot = playerId(other);
      if (slot === null) {
        return;
      }

      const name = playerName(other);
      const idMatch =
        searchId !== null && Number.isInteger(searchId) && slot === searchId;
      const nameMatch = name.toLowerCase().includes(needle);

      if (!idMatch && !nameMatch) {
        return;
      }

      const account = getAccount(other);
      const level = account
        ? Math.max(0, Math.floor(account.level))
        : readScore(other);
      const ping = readPing(other);

      player.sendClientMessage(
        Color.white,
        `Ник: ${name} | ID: ${slot} | Уровень: ${level} | Пинг: ${ping}`
      );
      count += 1;
    });

    if (count === 0) {
      player.sendClientMessage(
        Color.error,
        "Игроки с такими данными не найдены."
      );
    }
  }
);

function readPing(player: Player): number {
  try {
    const ping = Number(player.getPing());
    return Number.isFinite(ping) ? Math.max(0, Math.floor(ping)) : 0;
  } catch {
    return 0;
  }
}

function readScore(player: Player): number {
  try {
    const score = Number(player.getScore());
    return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  } catch {
    return 0;
  }
}
