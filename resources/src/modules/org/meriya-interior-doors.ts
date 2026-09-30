import { ObjectMp, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { ORG_FBI_ID } from "./fbi";
import { MERIYA_CUSTOM_INTERIOR, MERIYA_WORLD, ORG_MERIYA_ID } from "./meriya";
import { getMembership } from "./membership";

/** Левый Alt (KEY_WALK). */
const KEY_WALK = 1024;
const HOLD_OPEN_MS = 5000;
const TRAVEL_MS = 1200;
const DRAW_DISTANCE = 120;
const DENY_COOLDOWN_MS = 2500;
const PLAYER_STATE_ONFOOT = 1;
const DOOR_MODEL = 19859;
const DENY = "Открыть могут сотрудники Мэрии и FBI.";

const ALLOWED_ORGS: ReadonlySet<number> = new Set([ORG_MERIYA_ID, ORG_FBI_ID]);

type DoorDef = {
  x: number;
  yClosed: number;
  yOpen: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  radius: number;
};

type LiveDoor = {
  def: DoorDef;
  object: ObjectMp;
  closeTimer: ReturnType<typeof setTimeout> | null;
};

/** Служебная дверь у входа (сдвиг по Y). */
const DOORS: readonly DoorDef[] = [
  {
    x: -804.356018,
    yClosed: -685.916016,
    yOpen: -687.43597,
    z: 4001.341064,
    rx: 0,
    ry: 0,
    rz: 90,
    radius: 2.5,
  },
];

const doors: LiveDoor[] = [];
const denyAt = new Map<number, number>();

function travelSpeed(def: DoorDef): number {
  const dist = Math.abs(def.yOpen - def.yClosed);
  return Math.max(0.5, dist / (TRAVEL_MS / 1000));
}

function moveDoor(door: LiveDoor, open: boolean): void {
  const { def, object } = door;
  const y = open ? def.yOpen : def.yClosed;

  try {
    if (object.isMoving()) {
      object.stop();
    }
    object.move(def.x, y, def.z, travelSpeed(def), def.rx, def.ry, def.rz);
  } catch {
    // Объект ещё не готов.
  }
}

function openDoor(door: LiveDoor): void {
  if (door.closeTimer) {
    clearTimeout(door.closeTimer);
    door.closeTimer = null;
  }

  moveDoor(door, true);
  door.closeTimer = setTimeout(() => {
    door.closeTimer = null;
    moveDoor(door, false);
  }, TRAVEL_MS + HOLD_OPEN_MS);
}

function nearestDoor(player: Player): LiveDoor | null {
  let best: LiveDoor | null = null;
  let bestDist = Infinity;

  try {
    if (
      player.getInterior() !== MERIYA_CUSTOM_INTERIOR ||
      player.getVirtualWorld() !== MERIYA_WORLD
    ) {
      return null;
    }

    for (const door of doors) {
      const midY = (door.def.yClosed + door.def.yOpen) / 2;
      const dist = player.getDistanceFromPoint(door.def.x, midY, door.def.z);
      if (dist <= door.def.radius && dist < bestDist) {
        best = door;
        bestDist = dist;
      }
    }
  } catch {
    return null;
  }

  return best;
}

function denyOpen(player: Player): void {
  const id = playerId(player);
  const now = Date.now();
  if (id !== null) {
    const last = denyAt.get(id) ?? 0;
    if (now - last < DENY_COOLDOWN_MS) {
      return;
    }
    denyAt.set(id, now);
  }

  try {
    player.sendClientMessage(Color.error, DENY);
  } catch {
    // Игрок уже вышел.
  }
}

function onDoorKey(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return;
    }
  } catch {
    return;
  }

  const door = nearestDoor(player);
  if (!door) {
    return;
  }

  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!membership || !ALLOWED_ORGS.has(membership.org.id)) {
    denyOpen(player);
    return;
  }

  openDoor(door);
}

export function bindMeriyaInteriorDoors(): void {
  if (doors.length > 0) {
    return;
  }

  for (const def of DOORS) {
    try {
      const object = new ObjectMp(
        DOOR_MODEL,
        def.x,
        def.yClosed,
        def.z,
        def.rx,
        def.ry,
        def.rz,
        DRAW_DISTANCE
      );
      doors.push({ def, object, closeTimer: null });
    } catch {
      // Лимит объектов.
    }
  }

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = newKeys & ~oldKeys;
    if ((pressed & KEY_WALK) === 0) {
      return;
    }

    onDoorKey(player);
  });

  omp.on("playerConnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      denyAt.delete(id);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      denyAt.delete(id);
    }
  });
}
