import type { Player } from "@omp-node/core";
import { isPlayerActive } from "../../shared/player";
import { grantWeapon } from "../anticheat/trust";
import { addWarehouseAmmo, getWarehouse, takeWarehouseAmmo } from "../warehouse";

/** Дубинка — без расхода патронов склада. */
const FREE_WEAPON_IDS = new Set<number>([3]);

export type LockerAmmoItem = {
  kind: "armor" | "weapon" | "skin" | string;
  id: number;
  ammo?: number;
};

/**
 * Сколько патронов списать со склада за выдачу.
 * Броня, скин, дубинка — 0; огнестрел — полный комплект `ammo`.
 */
export function lockerAmmoCost(item: LockerAmmoItem): number {
  if (item.kind !== "weapon") {
    return 0;
  }

  if (FREE_WEAPON_IDS.has(item.id)) {
    return 0;
  }

  return Math.max(0, Math.floor(item.ammo ?? 0));
}

/** Подпись пункта меню: `Desert Eagle (50 патр.)` или без скобок если бесплатно. */
export function lockerItemLabel(label: string, item: LockerAmmoItem): string {
  const cost = lockerAmmoCost(item);
  return cost > 0 ? `${label} (${cost} патр.)` : label;
}

/**
 * Выдать оружие из оружейки: списание склада → выдача → возврат при сбое.
 * @returns текст ошибки или `null` при успехе.
 */
export function issueLockerWeapon(
  player: Player,
  orgId: number,
  weaponId: number,
  ammo: number,
  cost: number,
  refreshLabel: () => void
): string | null {
  const need = Math.max(0, Math.floor(cost));
  const giveAmmo = Math.max(1, Math.floor(ammo));

  if (need > 0) {
    if (!takeWarehouseAmmo(orgId, need)) {
      const have = getWarehouse(orgId)?.ammo ?? 0;
      return `Недостаточно патронов на складе (нужно ${need}, есть ${have}).`;
    }
    refreshLabel();
  }

  if (!isPlayerActive(player) || !grantWeapon(player, weaponId, giveAmmo)) {
    if (need > 0) {
      addWarehouseAmmo(orgId, need);
      refreshLabel();
    }
    return "Не удалось выдать снаряжение.";
  }

  return null;
}
