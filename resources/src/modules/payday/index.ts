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

    payPlayer(player, clock);
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
  player.sendClientMessage(Color.info, clock);
  player.sendClientMessage(Color.white, `Ochki opyta ${next.exp}/${need}`);

  const salary = orgPaydayPay(account);
  if (salary) {
    const fresh = getAccount(player) ?? account;
    const current = Math.max(0, Math.floor(fresh.bank));
    const credited = Math.min(salary.amount, Math.max(0, MAX_MONEY - current));
    if (credited > 0) {
      patchAccount(player, { bank: current + credited });
      queueSave(player);
    }
    player.sendClientMessage(
      Color.tryOk,
      credited > 0
        ? `Zarplata ${salary.orgName} (${salary.rankTitle}): $${credited} na bankovskiy schet.`
        : `Zarplata ne nachislena: bankovskiy schet zapolnen.`
    );
  }

  if (next.leveled) {
    player.sendClientMessage(
      Color.tryOk,
      `Pozdravlyaem, vash igrovoy uroven' byl povyshen do ${next.level}.`
    );
  }
}
