import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { ORG_ARMY_ID } from "./army";
import { ORG_FBI_ID } from "./fbi";
import { ORG_LSPD_ID } from "./lspd";
import { getMembership } from "./membership";

/** Общий интерьер аммунации; VW = org_id склада (1 армия, 4 полиция, 5 LSPD, 6 FBI). */
export const AMMUNATION_INTERIOR = 6;

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;

const INT_PICKUP = {
  x: 316.4231,
  y: -170.0309,
  z: 999.5938,
} as const;

const INT_ENTER: Omit<SpawnPoint, "world"> = {
  x: 316.3595,
  y: -167.8083,
  z: 999.5938,
  angle: 0.9635,
  interior: AMMUNATION_INTERIOR,
};

type AmmoDoor = {
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  dest: SpawnPoint;
  label: string;
  /** null = выход, проверка органа не нужна */
  allowedOrgIds: readonly number[] | null;
  denyMessage: string;
};

function ammoBranch(
  orgId: number,
  enterLabel: string,
  streetPickup: { x: number; y: number; z: number },
  streetExit: SpawnPoint,
  allowedOrgIds: readonly number[],
  denyMessage: string
): AmmoDoor[] {
  return [
    {
      pickup: {
        x: streetPickup.x,
        y: streetPickup.y,
        z: streetPickup.z,
        interior: 0,
        world: STREET_WORLD,
      },
      dest: { ...INT_ENTER, world: orgId },
      label: enterLabel,
      allowedOrgIds,
      denyMessage,
    },
    {
      pickup: {
        x: INT_PICKUP.x,
        y: INT_PICKUP.y,
        z: INT_PICKUP.z,
        interior: AMMUNATION_INTERIOR,
        world: orgId,
      },
      dest: streetExit,
      label: "Выход",
      allowedOrgIds: null,
      denyMessage,
    },
  ];
}

const LSPD_ARMY_ALLOWED = [ORG_LSPD_ID, ORG_FBI_ID] as const;
const ARMY_ALLOWED = [ORG_ARMY_ID, ORG_FBI_ID] as const;

const DOORS: readonly AmmoDoor[] = [
  ...ammoBranch(
    ORG_LSPD_ID,
    "Аммунация\nLSPD",
    { x: 1568.6284, y: -1690.084, z: 6.2188 },
    {
      x: 1568.538,
      y: -1692.2905,
      z: 5.8906,
      angle: 179.3687,
      interior: 0,
      world: STREET_WORLD,
    },
    LSPD_ARMY_ALLOWED,
    "Войти могут сотрудники LSPD и FBI."
  ),
  ...ammoBranch(
    ORG_ARMY_ID,
    "Аммунация\nАрмия",
    { x: 2721.2046, y: -2380.3906, z: 17.3403 },
    {
      x: 2721.2527,
      y: -2382.0422,
      z: 17.3403,
      angle: 182.5022,
      interior: 0,
      world: STREET_WORLD,
    },
    ARMY_ALLOWED,
    "Войти могут сотрудники Армии и FBI."
  ),
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();

export function bindAmmunationDoors(): void {
  for (const door of DOORS) {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z,
      door.pickup.world
    );
    new TextLabel(
      door.label,
      Color.info,
      door.pickup.x,
      door.pickup.y,
      door.pickup.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      door.pickup.world,
      false
    );
  }

  setInterval(tickAmmunationDoors, TICK_MS);

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickAmmunationDoors(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        return;
      }

      const world = player.getVirtualWorld();
      const interior = player.getInterior();
      const pos = player.getPos();
      for (const door of DOORS) {
        if (world !== door.pickup.world || interior !== door.pickup.interior) {
          continue;
        }

        if (near(pos, door.pickup)) {
          tryUse(player, door);
          return;
        }
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryUse(player: Player, door: AmmoDoor): void {
  if (door.allowedOrgIds) {
    const account = getAccount(player);
    if (account?.hospitalized) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
      return;
    }

    const membership = account ? getMembership(account) : null;
    const orgId = membership?.org.id;
    if (orgId === undefined || !door.allowedOrgIds.includes(orgId)) {
      deny(player, door.denyMessage);
      return;
    }
  }

  teleport(player, door.dest);
}

function deny(player: Player, message: string): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const last = lastDenyAt.get(id) ?? 0;
  if (now - last < DENY_COOLDOWN_MS) {
    return;
  }

  lastDenyAt.set(id, now);
  try {
    player.sendClientMessage(Color.error, message);
  } catch {
    // Игрок уже вышел.
  }
}

function teleport(player: Player, point: SpawnPoint): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const last = lastTeleportAt.get(id) ?? 0;
  if (now - last < TELEPORT_COOLDOWN_MS) {
    return;
  }

  lastTeleportAt.set(id, now);

  try {
    placeAt(player, point);
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

function near(
  pos: { x: number; y: number; z: number },
  point: { x: number; y: number; z: number }
): boolean {
  return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= PICKUP_RADIUS;
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
  }
}
