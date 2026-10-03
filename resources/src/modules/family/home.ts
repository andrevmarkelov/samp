import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { listFamilies } from "./catalog";
import { getFamilyMembership } from "./membership";
import { ensureFamilyHealPickup } from "./heal";
import { ensureFamilyStockDisplay } from "./stock-display";
import {
  familyIdFromVirtualWorld,
  familyVirtualWorld,
  isFamilyVirtualWorld,
} from "./world";

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const PICKUP_RADIUS = 1.5;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const TELEPORT_COOLDOWN_MS = 1500;
const TICK_MS = 200;

/** Пикап входа на улице. */
const STREET_PICKUP = {
  x: 1327.7509,
  y: -1556.4092,
  z: 13.5469,
} as const;

/** Точка выхода на улицу после телепорта. */
const STREET_EXIT: SpawnPoint = {
  x: 1325.9447,
  y: -1557.7162,
  z: 13.5397,
  angle: 126.0458,
  interior: 0,
  world: STREET_WORLD,
};

/** Пикап выхода в интерьере фамильного дома. */
const INTERIOR_PICKUP = {
  x: 200.1208,
  y: 4.9145,
  z: 1501.0079,
  interior: 0,
} as const;

/** Точка появления внутри дома. */
const INTERIOR_SPAWN = {
  x: 198.0291,
  y: 4.9097,
  z: 1501.0079,
  angle: 90.0123,
  interior: 0,
} as const;

type ExitProps = {
  pickup: Pickup;
  label: TextLabel;
};

const exitByFamily = new Map<number, ExitProps>();
const standingEnter = new Set<number>();
const standingExit = new Set<number>();
const lastTeleportAt = new Map<number, number>();

export function startFamilyHome(): void {
  new Pickup(
    PICKUP_MODEL,
    PICKUP_TYPE,
    STREET_PICKUP.x,
    STREET_PICKUP.y,
    STREET_PICKUP.z,
    STREET_WORLD
  );
  new TextLabel(
    "Дом семьи\nВход",
    Color.info,
    STREET_PICKUP.x,
    STREET_PICKUP.y,
    STREET_PICKUP.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    STREET_WORLD,
    false
  );

  for (const family of listFamilies()) {
    ensureFamilyHomeExit(family.id);
  }

  setInterval(tickFamilyHome, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    standingEnter.delete(id);
    standingExit.delete(id);
    lastTeleportAt.delete(id);
  });
}

/** Создать пикап выхода для VW семьи (после create / при старте). */
export function ensureFamilyHomeExit(familyId: number): void {
  if (exitByFamily.has(familyId)) {
    return;
  }

  const world = familyVirtualWorld(familyId);
  const pickup = new Pickup(
    PICKUP_MODEL,
    PICKUP_TYPE,
    INTERIOR_PICKUP.x,
    INTERIOR_PICKUP.y,
    INTERIOR_PICKUP.z,
    world
  );
  const label = new TextLabel(
    "Выход на улицу",
    Color.info,
    INTERIOR_PICKUP.x,
    INTERIOR_PICKUP.y,
    INTERIOR_PICKUP.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );

  exitByFamily.set(familyId, { pickup, label });
  ensureFamilyStockDisplay(familyId);
  ensureFamilyHealPickup(familyId);
}

/** Убрать пикап выхода при роспуске семьи. */
export function removeFamilyHomeExit(familyId: number): void {
  const props = exitByFamily.get(familyId);
  if (!props) {
    return;
  }

  try {
    props.pickup.destroy();
  } catch {
    // Уже уничтожен.
  }

  try {
    props.label.destroy();
  } catch {
    // Уже уничтожен.
  }

  exitByFamily.delete(familyId);
}

function tickFamilyHome(): void {
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
        standingEnter.delete(id);
        standingExit.delete(id);
        return;
      }

      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const interior = player.getInterior();

      const onStreet =
        world === STREET_WORLD &&
        interior === 0 &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          STREET_PICKUP.x,
          STREET_PICKUP.y,
          STREET_PICKUP.z
        ) <= PICKUP_RADIUS;

      if (onStreet) {
        if (!standingEnter.has(id)) {
          standingEnter.add(id);
          tryEnterFamilyHome(player);
        }
      } else {
        standingEnter.delete(id);
      }

      const onExit =
        isFamilyVirtualWorld(world) &&
        interior === INTERIOR_PICKUP.interior &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          INTERIOR_PICKUP.x,
          INTERIOR_PICKUP.y,
          INTERIOR_PICKUP.z
        ) <= PICKUP_RADIUS;

      if (onExit) {
        if (!standingExit.has(id)) {
          standingExit.add(id);
          tryExitFamilyHome(player);
        }
      } else {
        standingExit.delete(id);
      }
    } catch {
      standingEnter.delete(id);
      standingExit.delete(id);
    }
  });
}

function tryEnterFamilyHome(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Войти может только член семьи.");
    return;
  }

  if (!canTeleport(player)) {
    return;
  }

  const spawn: SpawnPoint = {
    x: INTERIOR_SPAWN.x,
    y: INTERIOR_SPAWN.y,
    z: INTERIOR_SPAWN.z,
    angle: INTERIOR_SPAWN.angle,
    interior: INTERIOR_SPAWN.interior,
    world: familyVirtualWorld(membership.family.id),
  };

  ensureFamilyHomeExit(membership.family.id);

  try {
    placeAt(player, spawn);
    refreshStreamForPlayer(player);
  } catch {
    tell(player, Color.error, "Не удалось войти в дом семьи.");
  }
}

function tryExitFamilyHome(player: Player): void {
  try {
    const world = player.getVirtualWorld();
    const familyId = familyIdFromVirtualWorld(world);
    if (familyId === null) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.familyId !== familyId) {
      // Чужой VW — всё равно выпускаем на улицу.
    }
  } catch {
    return;
  }

  if (!canTeleport(player)) {
    return;
  }

  try {
    placeAt(player, STREET_EXIT);
    refreshStreamForPlayer(player);
  } catch {
    tell(player, Color.error, "Не удалось выйти из дома семьи.");
  }
}

function canTeleport(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  const now = Date.now();
  const last = lastTeleportAt.get(id) ?? 0;
  if (now - last < TELEPORT_COOLDOWN_MS) {
    return false;
  }

  lastTeleportAt.set(id, now);
  return true;
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

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}
