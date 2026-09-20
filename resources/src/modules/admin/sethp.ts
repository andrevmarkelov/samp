import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { MAX_HEALTH, applyHealth, getAccount, patchAccount } from "../auth/session";
import { queueSave } from "../persist";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess, isAdminLoggedIn } from "./session";

const MIN_SET_HP = 0;

function parseSethpArgs(args: string): { slot: number; hp: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const hp = Number(parts[1]);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isFinite(hp)) {
    return null;
  }

  if (hp < MIN_SET_HP || hp > MAX_HEALTH) {
    return null;
  }

  return { slot, hp };
}

export function bindAdminSethp(): void {
  registerCommand(
    "sethp",
    "Установить HP игроку",
    (player, args) => {
      if (!hasAdminAccess(player, 4)) {
        return;
      }

      const parsed = parseSethpArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Использование: /sethp [id] [hp] (0-100)"
        );
        return;
      }

      const target = omp.players.at(parsed.slot);
      if (!target || !isPlayerActive(target)) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      try {
        if (target.isNPC()) {
          player.sendClientMessage(Color.error, "Игрок не найден.");
          return;
        }
      } catch {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      const samePlayer = playerId(target) === playerId(player);
      if (!samePlayer && isAdminLoggedIn(target)) {
        player.sendClientMessage(
          Color.error,
          "Администраторам запрещено изменять уровень здоровья."
        );
        return;
      }

      applyHealth(target, parsed.hp);
      if (getAccount(target)) {
        patchAccount(target, { health: parsed.hp });
        queueSave(target);
      }

      player.sendClientMessage(
        Color.info,
        `HP игрока ${parsed.slot} установлено: ${parsed.hp}`
      );
    },
    true
  );
}
