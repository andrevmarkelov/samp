import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { formatMoney } from "../../shared/money";
import { isPlayerActive } from "../../shared/player";
import { saveUserProgress } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount, applyScore, MAX_LAWFULNESS, normalizeLawfulness } from "../auth/session";
import type { GameModule } from "../types";
import { isPlayerAfk } from "../afk";
import { queueSave } from "../persist";
import { GANG_TURF_PAY_BONUS, orgPaydayPay } from "../org";
import { isGangOrgId, listTurfs } from "../zones/turf";
import { applyPaydayExp, formatClock, hourStamp } from "./progress";

const TICK_MS = 1000;
const MAX_MONEY = 2_147_483_647;
const PAYDAY_SOUND_ID = 6400;
const TAG_TIME = "{3399FF}";
const TAG_SALARY = "{66CC00}";
const TAG_BALANCE = "{00CC00}";

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

  // Снимок на весь payday: у всех членов банды одинаковая надбавка,
  // даже если капт сменит владельца зоны во время обхода игроков.
  const gangTurfCounts = snapshotGangTurfCounts();

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player) || isPlayerAfk(player)) {
      return;
    }

    try {
      payPlayer(player, clock, gangTurfCounts);
    } catch {
      // Один слот не должен рвать payday остальным.
    }
  });
}

function payPlayer(
  player: Player,
  clock: string,
  gangTurfCounts: ReadonlyMap<number, number>
): void {
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

  playPaydaySound(player);

  const salary = resolvePaydaySalary(account, gangTurfCounts);
  let credited = 0;
  if (salary) {
    const fresh = getAccount(player) ?? account;
    const current = Math.max(0, Math.floor(fresh.bank));
    credited = Math.min(salary.amount, Math.max(0, MAX_MONEY - current));
    if (credited > 0) {
      patchAccount(player, { bank: current + credited });
      queueSave(player);
    }
  }

  const bank = Math.max(0, Math.floor((getAccount(player) ?? account).bank));

  tell(player, Color.white, `Текущее время: ${TAG_TIME}${clock}`);
  tell(player, Color.white, "     БАНКОВСКИЙ ЧЕК");
  tell(player, Color.white, "______________________");
  if (salary) {
    tell(player, Color.white, `Зарплата: ${TAG_SALARY}${formatMoney(credited)}`);
  }
  tell(player, Color.white, `Текущий баланс счёта: ${TAG_BALANCE}${formatMoney(bank)}`);
  tell(player, Color.white, "______________________");

  if (next.leveled) {
    tell(player, Color.scene, "Поздравляем! Ваш уровень был повышен.");
  }
}

function snapshotGangTurfCounts(): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  if (GANG_TURF_PAY_BONUS <= 0) {
    return counts;
  }

  for (const turf of listTurfs()) {
    if (!isGangOrgId(turf.orgId)) {
      continue;
    }
    counts.set(turf.orgId, (counts.get(turf.orgId) ?? 0) + 1);
  }

  return counts;
}

function resolvePaydaySalary(
  account: { orgId: number; orgRank: number },
  gangTurfCounts: ReadonlyMap<number, number>
): { amount: number; orgName: string; rankTitle: string } | null {
  const salary = orgPaydayPay(account);
  if (!salary) {
    return null;
  }

  if (!isGangOrgId(account.orgId) || GANG_TURF_PAY_BONUS <= 0) {
    return salary;
  }

  const zones = gangTurfCounts.get(account.orgId) ?? 0;
  if (zones <= 0) {
    return salary;
  }

  return {
    ...salary,
    amount: Math.max(0, Math.floor(salary.amount + zones * GANG_TURF_PAY_BONUS)),
  };
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
