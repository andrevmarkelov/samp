import { omp, Pickup, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserInventory } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount } from "../auth/session";
import {
  ORG_ARMY_ID,
  ORG_AZTECAS_ID,
  ORG_BALLAS_ID,
  ORG_GROVE_ID,
  ORG_RIFA_ID,
  ORG_VAGOS_ID,
  getMembership,
} from "../org";
import { refreshArmyAmmoStockLabel } from "../org/army-locker";
import { STREET_WORLD } from "../spawn/point";
import { getWarehouse, takeWarehouseAmmo } from "../warehouse";

const PICKUP_MODEL = 3013;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.6;
const TICK_MS = 400;
/** Интервал выдачи патронов, пока стоишь на ящике. */
const LOOT_INTERVAL_MS = 2500;
/** Сколько патронов забирается со склада армии за тик. */
const AMMO_PER_TICK = 20;
/** Доля патронов, теряемых при смерти на базе. */
const DEATH_AMMO_LOSS_RATIO = 0.3;
const EMPTY_MSG_COOLDOWN_MS = 4000;

const GHETTO_GANG_IDS: ReadonlySet<number> = new Set([
  ORG_GROVE_ID,
  ORG_BALLAS_ID,
  ORG_VAGOS_ID,
  ORG_RIFA_ID,
  ORG_AZTECAS_ID,
]);

const CRATES: readonly { x: number; y: number; z: number }[] = [
  { x: 2792.6816, y: -2393.04, z: 13.956 },
  { x: 2743.3081, y: -2454.3604, z: 13.8623 },
];

/** Зона военной базы (смерть → потеря % патронов). */
const ARMY_BASE_ZONE = {
  minX: 2664.8,
  minY: -2589.1,
  maxX: 2864.8,
  maxY: -2306.1,
} as const;

const lastLootAt = new Map<number, number>();
const lastEmptyMsgAt = new Map<number, number>();

export function bindArmyAmmoCrates(): void {
  for (const crate of CRATES) {
    new Pickup(PICKUP_MODEL, PICKUP_TYPE, crate.x, crate.y, crate.z, STREET_WORLD);
  }

  setInterval(tickCrates, TICK_MS);

  omp.on("playerDeath", (player) => {
    onDeathInArmyBase(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      lastLootAt.delete(id);
      lastEmptyMsgAt.delete(id);
    }
  });
}

function tickCrates(): void {
  omp.players.forEach((player) => {
    tryLootCrate(player);
  });
}

function tryLootCrate(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }

    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return;
    }
  } catch {
    return;
  }

  if (!isGhettoGangMember(player)) {
    return;
  }

  let pos: { x: number; y: number; z: number };
  try {
    pos = player.getPos();
  } catch {
    return;
  }

  const onCrate = CRATES.some(
    (crate) => Math.hypot(pos.x - crate.x, pos.y - crate.y, pos.z - crate.z) <= PICKUP_RADIUS
  );
  if (!onCrate) {
    return;
  }

  const now = Date.now();
  const last = lastLootAt.get(id) ?? 0;
  if (now - last < LOOT_INTERVAL_MS) {
    return;
  }

  lastLootAt.set(id, now);

  const stock = getWarehouse(ORG_ARMY_ID)?.ammo ?? 0;
  if (stock <= 0) {
    notifyEmpty(player, id, now);
    return;
  }

  const take = Math.min(AMMO_PER_TICK, stock);
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const nextAmmo = account.ammo + take;
  if (!Number.isSafeInteger(nextAmmo)) {
    player.sendClientMessage(Color.error, "Слишком много патронов при себе.");
    return;
  }

  if (!takeWarehouseAmmo(ORG_ARMY_ID, take)) {
    notifyEmpty(player, id, now);
    return;
  }

  patchAccount(player, { ammo: nextAmmo });
  void saveUserInventory(account.id, account.drugs, nextAmmo, account.metal).catch(() => {
    // Кэш уже обновлён.
  });
  refreshArmyAmmoStockLabel();
  player.sendClientMessage(Color.info, `+${take} патронов (склад армии).`);
}

function notifyEmpty(player: Player, id: number, now: number): void {
  if (now - (lastEmptyMsgAt.get(id) ?? 0) < EMPTY_MSG_COOLDOWN_MS) {
    return;
  }

  lastEmptyMsgAt.set(id, now);
  player.sendClientMessage(Color.error, "Ящик пуст: на складе армии нет патронов.");
}

function onDeathInArmyBase(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return;
    }

    const pos = player.getPos();
    if (!isInsideArmyBaseZone(pos.x, pos.y)) {
      return;
    }
  } catch {
    return;
  }

  const account = getAccount(player);
  if (!account || account.ammo <= 0) {
    return;
  }

  const lost = Math.max(1, Math.floor(account.ammo * DEATH_AMMO_LOSS_RATIO));
  const nextAmmo = Math.max(0, account.ammo - lost);
  if (nextAmmo === account.ammo) {
    return;
  }

  patchAccount(player, { ammo: nextAmmo });
  void saveUserInventory(account.id, account.drugs, nextAmmo, account.metal).catch(() => {
    // Кэш уже обновлён.
  });
  player.sendClientMessage(
    Color.error,
    `На военной базе вы потеряли ${lost} патронов.`
  );
}

function isInsideArmyBaseZone(x: number, y: number): boolean {
  return (
    x >= ARMY_BASE_ZONE.minX &&
    x <= ARMY_BASE_ZONE.maxX &&
    y >= ARMY_BASE_ZONE.minY &&
    y <= ARMY_BASE_ZONE.maxY
  );
}

function isGhettoGangMember(player: Player): boolean {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  const membership = getMembership(account);
  return membership !== null && GHETTO_GANG_IDS.has(membership.org.id);
}
