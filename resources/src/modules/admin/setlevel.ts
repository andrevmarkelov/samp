import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { saveUserProgress } from "../auth/repository";
import {
  applyScore,
  getAccount,
  normalizeLawfulness,
  patchAccount,
} from "../auth/session";
import { MAX_LEVEL, expForNextLevel } from "../payday/progress";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_ADMIN_LEVEL = 6;
const MIN_PLAYER_LEVEL = 1;
const pending = new Set<number>();

function parseArgs(args: string): { slot: number; level: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const slot = Number(parts[0]);
  const level = Number(parts[1]);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(level)) {
    return null;
  }

  if (level < MIN_PLAYER_LEVEL || level > MAX_LEVEL) {
    return null;
  }

  return { slot, level };
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

export function bindAdminSetlevel(): void {
  registerCommand(
    "setlevel",
    "Установить игровой уровень",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_ADMIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          `Использование: /setlevel [id] [lvl] (${MIN_PLAYER_LEVEL}-${MAX_LEVEL})`
        );
        return;
      }

      const target = findTarget(parsed.slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      if (!getAccount(target)) {
        player.sendClientMessage(Color.error, "Игрок не найден.");
        return;
      }

      void applyLevel(player, target, parsed.level);
    },
    true
  );
}

async function applyLevel(admin: Player, target: Player, level: number): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  if (pending.has(account.id)) {
    admin.sendClientMessage(Color.error, "Уровень этого игрока уже меняют. Подождите.");
    return;
  }

  const need = expForNextLevel(level);
  pending.add(account.id);
  try {
    patchAccount(target, { level, exp: 0 });
    applyScore(target, level);

    const lawfulness = normalizeLawfulness(getAccount(target)?.lawfulness ?? account.lawfulness);
    await saveUserProgress(account.id, level, 0, lawfulness);

    if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
      admin.sendClientMessage(
        Color.info,
        `Вы установили уровень ${level}. Игрок вышел, уровень сохранён.`
      );
      return;
    }

    const live = getAccount(target);
    const liveLaw = normalizeLawfulness(live?.lawfulness ?? lawfulness);
    const paydayTouched = !!live && (live.level !== level || live.exp !== 0);
    patchAccount(target, { level, exp: 0 });
    applyScore(target, level);
    if (paydayTouched || liveLaw !== lawfulness) {
      await saveUserProgress(account.id, level, 0, liveLaw);
    }

    const targetTag = playerChatName(target);
    const adminTag = playerChatName(admin);

    admin.sendClientMessage(
      Color.info,
      `Вы установили уровень игроку ${targetTag}: ${level}. Опыт: 0/${need}.`
    );

    if (isPlayerActive(target)) {
      target.sendClientMessage(
        Color.info,
        `Администратор ${adminTag} установил вам уровень ${level}. Опыт: 0/${need}.`
      );
    }
  } catch {
    admin.sendClientMessage(Color.error, "Не удалось сохранить уровень.");
  } finally {
    pending.delete(account.id);
  }
}
