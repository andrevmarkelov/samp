import type { Player } from "@omp-node/core";
import { playerId } from "../../../shared/player";
import { AcCode, isValidWeaponId, WEAPON_SLOTS } from "../codes";
import { isCodeEnabled } from "../config";
import { nowMs } from "../math";
import { reportCheat } from "../punish";
import { getPlayerState } from "../state";

const ALLOW_WITHOUT_TRUST = new Set([0, 46]); // fists / parachute

export function checkWeapons(player: Player): void {
  const id = playerId(player);
  if (id === null) return;
  const state = getPlayerState(id);
  if (!state || !state.spawned || state.dead || state.spectating) return;
  if (nowMs() < state.weaponTrustedUntil) return;

  for (let slot = 0; slot < WEAPON_SLOTS; slot += 1) {
    let data: { weapons?: number; weapon?: number; ammo?: number };
    try {
      data = player.getWeaponData(slot) as {
        weapons?: number;
        weapon?: number;
        ammo?: number;
      };
    } catch {
      continue;
    }

    const weaponId = Number(data.weapons ?? data.weapon ?? 0);
    const ammo = Number(data.ammo ?? 0);
    const expected = state.weapons[slot];
    if (!expected) continue;

    if (weaponId > 0 && !isValidWeaponId(weaponId)) {
      if (isCodeEnabled(AcCode.WeaponCrasher)) {
        reportCheat(player, AcCode.WeaponCrasher, `id=${weaponId}`);
        return;
      }
    }

    if (
      isCodeEnabled(AcCode.Weapon) &&
      weaponId > 0 &&
      !ALLOW_WITHOUT_TRUST.has(weaponId) &&
      expected.id !== weaponId
    ) {
      reportCheat(
        player,
        AcCode.Weapon,
        `slot=${slot} got=${weaponId} exp=${expected.id}`
      );
      return;
    }

    // Клиент стрелял - патронов стало меньше: подтянуть ожидаемое вниз.
    if (expected.id > 0 && weaponId === expected.id && ammo >= 0 && ammo < expected.ammo) {
      expected.ammo = ammo;
    }

    if (
      isCodeEnabled(AcCode.AmmoAdd) &&
      expected.id > 0 &&
      weaponId === expected.id &&
      ammo > expected.ammo + 8
    ) {
      reportCheat(
        player,
        AcCode.AmmoAdd,
        `slot=${slot} ammo=${ammo} exp=${expected.ammo}`
      );
      return;
    }
  }
}
