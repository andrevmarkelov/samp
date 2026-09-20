import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import { saveUserProgress } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount, applyScore, MAX_LAWFULNESS, normalizeLawfulness } from "../auth/session";
import type { GameModule } from "../types";
import { isPlayerAfk } from "../afk";
import { queueSave } from "../persist";
import { orgPaydayPay } from "../org";
import { applyPaydayExp, expForNextLevel, formatClock, hourStamp } from "./progress";

const TICK_MS = 1000;
const MAX_MONEY = 2_147_483_647;
const PAYDAY_SOUND_ID = 6400;

let lastHour = "";

export const paydayModule: GameModule = {
  name: "payday",
  start() {
    lastHour = hourStamp(new Date());

    setInterval(() => {
      const now = new Date();
      const stamp = hourStamp(now);
      if (stamp === lastHour) {
        return;
      }

      lastHour = stamp;
      runPayday(now);
    }, TICK_MS);
  },
};

function runPayday(now: Date): void {
  const clock = formatClock(now);
  omp.log(`[${SERVER_TAG}] payday ${clock}`);

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player) || isPlayerAfk(player)) {
      return;
    }

    try {
      payPlayer(player, clock);
    } catch {
      // Один слот не должен рвать payday остальным.
    }
  });
}

function payPlayer(player: Player, clock: string): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const next = applyPaydayExp(account.level, account.exp);
  const currentLaw = normalizeLawfulness(account.lawfulness);
  const lawfulness = currentLaw < MAX_LAWFULNESS ? currentLaw + 1 : MAX_LAWFULNESS;
  patchAccount(player, { level: next.level, exp: next.exp, lawfulness });
  applyScore(player, next.level);
  void saveUserProgress(account.id, next.level, next.exp, lawfulness).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить payday ${account.name}: ${message}`);
  });

  const need = expForNextLevel(next.level);
  playPaydaySound(player);
  tell(player, Color.info, clock);
  tell(player, Color.white, `Очки опыта ${next.exp}/${need}`);

  const salary = orgPaydayPay(account);
  if (salary) {
    const fresh = getAccount(player) ?? account;
    const current = Math.max(0, Math.floor(fresh.bank));
    const credited = Math.min(salary.amount, Math.max(0, MAX_MONEY - current));
    if (credited > 0) {
      patchAccount(player, { bank: current + credited });
      queueSave(player);
    }
    tell(
      player,
      Color.tryOk,
      credited > 0
        ? `Зарплата ${salary.orgName} (${salary.rankTitle}): $${credited} на банковский счёт.`
        : `Зарплата не начислена: банковский счёт заполнен.`
    );
  }

  if (next.leveled) {
    tell(
      player,
      Color.tryOk,
      `Поздравляем, ваш игровой уровень был повышен до ${next.level}.`
    );
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Слот пустой.
  }
}

function playPaydaySound(player: Player): void {
  try {
    const pos = player.getPos();
    player.playGameSound(PAYDAY_SOUND_ID, pos.x, pos.y, pos.z);
  } catch {
    try {
      player.playGameSound(PAYDAY_SOUND_ID, 0, 0, 0);
    } catch {
      // Слот пустой.
    }
  }
}
