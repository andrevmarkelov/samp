import type { Player } from "@omp-node/core";
import { playerId } from "../../shared/player";
import { weaponSlot, WEAPON_SLOTS } from "./codes";
import { getConfig } from "./config";
import { nowMs } from "./math";
import { getPlayerState } from "./state";

function stateOf(player: Player) {
  const id = playerId(player);
  if (id === null) return null;
  return getPlayerState(id);
}

export function trustPosition(
  player: Player,
  x: number,
  y: number,
  z: number,
  interior?: number,
  world?: number
): void {
  const state = stateOf(player);
  if (!state) return;
  state.x = x;
  state.y = y;
  state.z = z;
  if (interior !== undefined) state.interior = interior;
  if (world !== undefined) state.world = world;
  state.posTrustedUntil = nowMs() + getConfig().posGraceMs;
}

export function trustMoney(player: Player, money: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.money = Math.max(0, Math.floor(money));
  state.moneyTrustedUntil = nowMs() + getConfig().moneyGraceMs;
}

export function trustHealth(player: Player, health: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.health = health;
  state.healthTrustedUntil = nowMs() + getConfig().healthGraceMs;
}

export function trustArmour(player: Player, armour: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.armour = Math.max(0, armour);
  state.armourTrustedUntil = nowMs() + getConfig().healthGraceMs;
}

export function trustWeapon(player: Player, weaponId: number, ammo: number): void {
  const state = stateOf(player);
  if (!state) return;
  const slot = weaponSlot(weaponId);
  if (slot < 0 || slot >= WEAPON_SLOTS) return;
  const cur = state.weapons[slot];
  if (!cur) return;
  // giveWeapon в SA добавляет патроны к слоту, не заменяет.
  if (cur.id === weaponId) {
    cur.ammo = Math.max(0, cur.ammo + Math.floor(ammo));
  } else {
    cur.id = weaponId;
    cur.ammo = Math.max(0, Math.floor(ammo));
  }
  state.weaponTrustedUntil = nowMs() + getConfig().weaponGraceMs;
}

export function clearTrustedWeapons(player: Player): void {
  const state = stateOf(player);
  if (!state) return;
  for (const slot of state.weapons) {
    slot.id = 0;
    slot.ammo = 0;
  }
  state.weaponTrustedUntil = nowMs() + getConfig().weaponGraceMs;
}

export function trustVehicle(player: Player, vehicleId: number, seat: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.vehicleId = vehicleId;
  state.seat = seat;
  state.vehicleTrustedUntil = nowMs() + getConfig().posGraceMs;
}

export function trustSpecialAction(player: Player, action: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.specialAction = action;
}

export function trustDialog(player: Player, dialogId: number): void {
  const state = stateOf(player);
  if (!state) return;
  state.dialogId = dialogId;
}

export function markSpawned(player: Player, spawned: boolean): void {
  const state = stateOf(player);
  if (!state) return;
  state.spawned = spawned;
  if (spawned) {
    const now = nowMs();
    state.dead = false;
    state.posTrustedUntil = now + getConfig().posGraceMs;
    state.healthTrustedUntil = now + getConfig().healthGraceMs;
    state.moneyTrustedUntil = now + getConfig().moneyGraceMs;
  }
}

export function markDead(player: Player, dead: boolean): void {
  const state = stateOf(player);
  if (!state) return;
  state.dead = dead;
}

export function markSpectating(player: Player, spectating: boolean): void {
  const state = stateOf(player);
  if (!state) return;
  state.spectating = spectating;
  if (spectating) {
    state.posTrustedUntil = nowMs() + getConfig().posGraceMs;
  }
}

/** Выдать оружие и пометить как легитимное. */
export function grantWeapon(player: Player, weaponId: number, ammo: number): void {
  try {
    player.giveWeapon(weaponId, ammo);
  } catch {
    return;
  }
  trustWeapon(player, weaponId, ammo);
  // Подтянуть факт с клиента после выдачи (если getWeaponData доступен).
  try {
    const slot = weaponSlot(weaponId);
    if (slot < 0) return;
    const data = player.getWeaponData(slot) as {
      weapons?: number;
      weapon?: number;
      ammo?: number;
    };
    const gotId = Number(data.weapons ?? data.weapon ?? 0);
    const gotAmmo = Number(data.ammo ?? 0);
    const state = stateOf(player);
    if (!state || !state.weapons[slot]) return;
    if (gotId === weaponId && gotAmmo >= 0) {
      state.weapons[slot].id = gotId;
      state.weapons[slot].ammo = gotAmmo;
      state.weaponTrustedUntil = nowMs() + getConfig().weaponGraceMs;
    }
  } catch {
    // ignore
  }
}

export function grantArmour(player: Player, armour: number): void {
  try {
    player.setArmor(armour);
  } catch {
    return;
  }
  trustArmour(player, armour);
}

export function setTrustedHealth(player: Player, health: number): void {
  try {
    player.setHealth(health);
  } catch {
    return;
  }
  trustHealth(player, health);
}
