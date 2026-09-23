import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { grantArmour, grantWeapon } from "../anticheat/trust";
import { getAccount, isAuthenticated } from "../auth/session";
import { STREET_WORLD } from "../spawn/point";
import { CITY_HALL_INTERIOR, ORG_MERIYA_ID } from "./meriya";
import { getMembership } from "./membership";

const PICKUP_MODEL = 19134;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const MAX_ARMOR = 100;
const WEAPON_NIGHTSTICK = 3;
const WEAPON_DEAGLE = 24;
const DEAGLE_AMMO = 50;
const DENY = "Вы не состоите в мэрии.";

const POINT = {
  x: 357.6911,
  y: 150.9142,
  z: 1025.7891,
} as const;

const inside = new Set<number>();

export function bindMeriyaLocker(): void {
  new Pickup(PICKUP_MODEL, PICKUP_TYPE, POINT.x, POINT.y, POINT.z, STREET_WORLD);
  new TextLabel(
    "Склад мэрии\nБроня, дубинка, Deagle",
    Color.info,
    POINT.x,
    POINT.y,
    POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    STREET_WORLD,
    false
  );

  setInterval(tickLocker, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickLocker(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        inside.delete(id);
        return;
      }

      if (
        player.getVirtualWorld() !== STREET_WORLD ||
        player.getInterior() !== CITY_HALL_INTERIOR
      ) {
        inside.delete(id);
        return;
      }

      const pos = player.getPos();
      if (distance3d(pos.x, pos.y, pos.z, POINT.x, POINT.y, POINT.z) > PICKUP_RADIUS) {
        inside.delete(id);
        return;
      }

      if (inside.has(id)) {
        return;
      }

      inside.add(id);
      tryTake(player);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryTake(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (account.hospitalized) {
    tell(player, Color.error, "Сначала пройдите лечение в больнице.");
    return;
  }

  const membership = getMembership(account);
  if (!membership || membership.org.id !== ORG_MERIYA_ID) {
    tell(player, Color.error, DENY);
    return;
  }

  try {
    grantArmour(player, MAX_ARMOR);
    grantWeapon(player, WEAPON_NIGHTSTICK, 1);
    grantWeapon(player, WEAPON_DEAGLE, DEAGLE_AMMO);
  } catch {
    tell(player, Color.error, "Не удалось выдать снаряжение.");
    return;
  }

  tell(player, Color.info, "Вы взяли бронежилет, дубинку и Desert Eagle.");
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Игрок уже вышел.
  }
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

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    inside.delete(id);
  }
}
