import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerChatName } from "../../shared/player";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { isBankBusy } from "../bank/tellers";
import { registerCommand } from "../commands/registry";
import { hasAdminAccess } from "./session";

const MIN_LEVEL = 6;
const MAX_MONEY = 2_147_483_647;
const pending = new Set<number>();

function parseArgs(
  args: string
): { toBank: boolean; slot: number; amount: number } | null {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const slot = Number(parts[0]);
  const kind = Number(parts[1]);
  const rawAmount = parts[2].replace(/^\$/, "");
  const amount = Number(rawAmount);
  if (kind !== 0 && kind !== 1) {
    return null;
  }

  if (!Number.isInteger(slot) || slot < 0) {
    return null;
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_MONEY) {
    return null;
  }

  return { toBank: kind === 1, slot, amount };
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

function notifyGive(
  admin: Player,
  target: Player,
  credited: number,
  toBank: boolean
): void {
  const targetTag = playerChatName(target);
  const adminTag = playerChatName(admin);
  const where = toBank ? "na bankovskiy schet" : "nalichnymi";

  admin.sendClientMessage(
    Color.info,
    `Vy vydali igroku ${targetTag} $${credited} ${where}.`
  );

  if (isPlayerActive(target)) {
    target.sendClientMessage(
      Color.info,
      `Administrator ${adminTag} vydal vam $${credited} ${where}.`
    );
  }
}

export function bindAdminGivemoney(): void {
  registerCommand(
    "givemoney",
    "Vydat' nalichnye ili den'gi na bank",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      const parsed = parseArgs(args);
      if (!parsed) {
        player.sendClientMessage(
          Color.error,
          "Ispol'zovanie: /givemoney [id] [0-1] [summa] (0 - nalichnye, 1 - bank)"
        );
        return;
      }

      const target = findTarget(parsed.slot);
      if (!target) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      if (!getAccount(target)) {
        player.sendClientMessage(Color.error, "Igrok ne nayden.");
        return;
      }

      void applyGive(player, target, parsed.toBank, parsed.amount);
    },
    true
  );
}

async function applyGive(
  admin: Player,
  target: Player,
  toBank: boolean,
  amount: number
): Promise<void> {
  const account = getAccount(target);
  if (!account) {
    return;
  }

  if (pending.has(account.id)) {
    admin.sendClientMessage(Color.error, "Dengi etomu igroku uzhe vydayut. Podozhdite.");
    return;
  }

  const cash = Math.max(0, Math.floor(account.money));
  const bank = Math.max(0, Math.floor(account.bank));
  const current = toBank ? bank : cash;
  const credited = Math.min(amount, Math.max(0, MAX_MONEY - current));
  if (credited <= 0) {
    admin.sendClientMessage(
      Color.error,
      toBank ? "Bankovskiy schet zapolnen." : "Nalichnye zapolneny."
    );
    return;
  }

  const nextCash = toBank ? cash : cash + credited;
  const nextBank = toBank ? bank + credited : bank;

  pending.add(account.id);
  try {
    patchAccount(target, { money: nextCash, bank: nextBank });
    if (!toBank) {
      const given = getAccount(target);
      if (given) {
        applyWallet(target, given);
      }
    }

    if (isBankBusy(target)) {
      notifyGive(admin, target, credited, toBank);
      return;
    }

    await saveUserMoney(account.id, nextCash, nextBank);

    if (!isPlayerActive(target) || getAccount(target)?.id !== account.id) {
      admin.sendClientMessage(
        Color.info,
        `Vy vydali $${credited}. Igrok vyshel, summa sohranena.`
      );
      return;
    }

    const live = getAccount(target);
    const extraCash = Math.max(0, Math.floor(live?.money ?? nextCash) - nextCash);
    const extraBank = Math.max(0, Math.floor(live?.bank ?? nextBank) - nextBank);
    if (extraCash > 0 || extraBank > 0) {
      const cashNow = Math.min(MAX_MONEY, nextCash + extraCash);
      const bankNow = Math.min(MAX_MONEY, nextBank + extraBank);
      patchAccount(target, { money: cashNow, bank: bankNow });
      await saveUserMoney(account.id, cashNow, bankNow);
      const fresh = getAccount(target);
      if (fresh) {
        applyWallet(target, fresh);
      }
    }

    notifyGive(admin, target, credited, toBank);
  } catch {
    const still = getAccount(target);
    if (still?.id === account.id) {
      const extraCash = Math.max(0, Math.floor(still.money) - nextCash);
      const extraBank = Math.max(0, Math.floor(still.bank) - nextBank);
      patchAccount(target, {
        money: Math.min(MAX_MONEY, cash + extraCash),
        bank: Math.min(MAX_MONEY, bank + extraBank),
      });
      const fresh = getAccount(target);
      if (fresh) {
        applyWallet(target, fresh);
      }
    }
    admin.sendClientMessage(Color.error, "Ne udalos' sohranit' dengi.");
  } finally {
    pending.delete(account.id);
  }
}
