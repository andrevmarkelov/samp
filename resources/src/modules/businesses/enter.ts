import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import type { BusinessRecord } from "./repository";
import {
  businessHasInterior,
  getBusiness,
  listBusinesses,
  payBusinessEntranceFee,
  setBusinessBalance,
} from "./repository";
import { setInsideBusiness } from "./session";
import { businessVirtualWorld } from "./world";

/** Левый ALT — медленная ходьба (KEY_WALK). */
const KEY_WALK = 1024;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const TELEPORT_COOLDOWN_MS = 1500;

const nearEntrance = new Map<number, number>();
const lastTeleportAt = new Map<number, number>();
const entering = new Set<number>();

export function startBusinessEntrances(): void {
  setInterval(tickBusinessEntrances, TICK_MS);

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_WALK) === 0) {
      return;
    }

    void tryEnterBusiness(player);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      nearEntrance.delete(id);
      lastTeleportAt.delete(id);
    }

    const account = getAccount(player);
    if (account) {
      entering.delete(account.id);
    }
  });
}

function tickBusinessEntrances(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();

      if (world !== STREET_WORLD || interior !== 0 || player.getState() !== PLAYER_STATE_ONFOOT) {
        nearEntrance.delete(id);
        return;
      }

      const business = findBusinessEntranceAt(pos.x, pos.y, pos.z);
      if (!business || !businessHasInterior(business)) {
        nearEntrance.delete(id);
        return;
      }

      nearEntrance.set(id, business.id);
    } catch {
      nearEntrance.delete(id);
    }
  });
}

async function tryEnterBusiness(player: Player): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const slotId = playerId(player);
  const account = getAccount(player);
  if (slotId === null || !account) {
    return;
  }

  const businessId = nearEntrance.get(slotId);
  if (businessId === undefined) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !businessHasInterior(business)) {
    nearEntrance.delete(slotId);
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }

    const pos = player.getPos();
    const world = player.getVirtualWorld();
    const interior = player.getInterior();
    if (
      world !== STREET_WORLD ||
      interior !== 0 ||
      !isNearEntrance(pos.x, pos.y, pos.z, business)
    ) {
      nearEntrance.delete(slotId);
      return;
    }
  } catch {
    return;
  }

  if (business.isLocked && business.ownerId !== account.id) {
    player.sendClientMessage(Color.error, "Бизнес закрыт.");
    return;
  }

  const now = Date.now();
  const last = lastTeleportAt.get(slotId) ?? 0;
  if (now - last < TELEPORT_COOLDOWN_MS) {
    return;
  }

  const isOwner = business.ownerId === account.id;
  const fee = isOwner ? 0 : business.entranceFee;

  if (fee > 0) {
    const cash = Math.max(0, Math.floor(account.money));
    if (cash < fee) {
      player.sendClientMessage(Color.error, "Недостаточно наличных для входа.");
      return;
    }

    if (entering.has(account.id)) {
      return;
    }

    entering.add(account.id);
    let result;
    try {
      result = await payBusinessEntranceFee(business.id, account.id, fee);
    } catch (error: unknown) {
      entering.delete(account.id);
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] вход в бизнес ${business.id} (${account.name}): ${message}`);
      player.sendClientMessage(Color.error, "Не удалось оплатить вход.");
      return;
    }
    entering.delete(account.id);

    if (!result.ok) {
      if (result.reason === "funds") {
        player.sendClientMessage(Color.error, "Недостаточно наличных для входа.");
        return;
      }
      player.sendClientMessage(Color.error, "Не удалось оплатить вход.");
      return;
    }

    // БД уже обновлена в транзакции — кэш всегда синхронизируем.
    if (result.cashLeft >= 0) {
      setBusinessBalance(business.id, result.balance);
    }

    if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
      return;
    }

    if (result.cashLeft >= 0) {
      patchAccount(player, { money: result.cashLeft });
      const live = getAccount(player);
      if (live) {
        applyWallet(player, live);
      }
    }
  }

  lastTeleportAt.set(slotId, Date.now());
  nearEntrance.delete(slotId);

  if (!teleportToBusinessInterior(player, business)) {
    player.sendClientMessage(Color.error, "Не удалось войти в бизнес.");
  }
}

export function teleportToBusinessInterior(player: Player, business: BusinessRecord): boolean {
  const slotId = playerId(player);
  if (
    slotId === null ||
    business.interiorId === null ||
    business.interiorX === null ||
    business.interiorY === null ||
    business.interiorZ === null
  ) {
    return false;
  }

  const point: SpawnPoint = {
    x: business.interiorX,
    y: business.interiorY,
    z: business.interiorZ,
    angle: 0,
    interior: business.interiorId,
    world: businessVirtualWorld(business.id),
  };

  try {
    placeAt(player, point);
    refreshStreamForPlayer(player);
    setInsideBusiness(slotId, business.id);
    return true;
  } catch {
    return false;
  }
}

function findBusinessEntranceAt(x: number, y: number, z: number): BusinessRecord | null {
  let best: BusinessRecord | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const business of listBusinesses()) {
    const distance = distance3d(
      x,
      y,
      z,
      business.entranceX,
      business.entranceY,
      business.entranceZ
    );
    if (distance > PICKUP_RADIUS || distance >= bestDistance) {
      continue;
    }

    best = business;
    bestDistance = distance;
  }

  return best;
}

function isNearEntrance(x: number, y: number, z: number, business: BusinessRecord): boolean {
  return (
    distance3d(x, y, z, business.entranceX, business.entranceY, business.entranceZ) <=
    PICKUP_RADIUS
  );
}

function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}
