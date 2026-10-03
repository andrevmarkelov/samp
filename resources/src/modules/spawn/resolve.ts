import type { Account } from "../auth/session";
import { resolveOrgSpawn } from "../org";
import { isJailedAccount, pickJailCell } from "../prison/sentence";
import { DEFAULT_SPAWN, pickHospitalSpawn, type SpawnPoint } from "./point";

/**
 * Куда ставить игрока: тюрьма → больница → орган → обычный спавн.
 * Та же логика, что после логина.
 */
export function resolveAccountSpawn(
  account: Account | null | undefined
): SpawnPoint {
  if (account && isJailedAccount(account)) {
    return pickJailCell();
  }

  if (account?.hospitalized) {
    return pickHospitalSpawn();
  }

  return resolveOrgSpawn(account) ?? DEFAULT_SPAWN;
}
