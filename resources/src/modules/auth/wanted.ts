import type { Player } from "@omp-node/core";
import { saveUserWantedLevel } from "./repository";
import {
  applyWantedLevel,
  getAccount,
  normalizeWantedLevel,
  patchAccount,
} from "./session";

/** Выставить розыск 0–6: кэш, звёзды SA, БД. */
export function setPlayerWantedLevel(player: Player, level: number): void {
  const wanted = normalizeWantedLevel(level);
  const account = getAccount(player);
  if (!account) {
    return;
  }

  patchAccount(player, { wantedLevel: wanted });
  applyWantedLevel(player, wanted);
  void saveUserWantedLevel(account.id, wanted).catch(() => {
    // Кэш и клиент уже обновлены.
  });
}
