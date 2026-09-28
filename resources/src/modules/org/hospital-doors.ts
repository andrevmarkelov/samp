import { ObjectMp, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { HOSPITAL_WORLD } from "../spawn/point";
import { ORG_HOSPITAL_ID } from "./hospital";
import { getMembership } from "./membership";

/** Левый Alt (KEY_WALK). */
const KEY_WALK = 1024;
const HOLD_OPEN_MS = 5000;
const TRAVEL_MS = 1200;
const Z_BUMP = 0.02;
const DRAW_DISTANCE = 120;
const DENY_COOLDOWN_MS = 2500;
const PLAYER_STATE_ONFOOT = 1;
const DENY = "Вы не состоите в больнице.";

type DoorDef = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rzClosed: number;
  rzOpen: number;
  radius: number;
};

type LiveDoor = {
  def: DoorDef;
  object: ObjectMp;
  closeTimer: ReturnType<typeof setTimeout> | null;
};

/** Двери служебного блока (закрыто → открыто = поворот rz). */
const DOORS: readonly DoorDef[] = [
  {
    x: 1147.775024,
    y: -1349.958984,
    z: 3001.340088,
    rx: 0,
    ry: 0,
    rzClosed: 90,
    rzOpen: 0,
    radius: 2.5,
  },
  {
    x: 1150.317993,
    y: -1341.121948,
    z: 3001.340088,
    rx: 0,
    ry: 0,
    rzClosed: 0,
    rzOpen: -90,
    radius: 2.5,
  },
  {
    x: 1154.375,
    y: -1345.244995,
    z: 3001.340088,
    rx: 0,
    ry: 0,
    rzClosed: 270,
    rzOpen: 180,
    radius: 2.5,
  },
  {
    x: 1154.390015,
    y: -1348.453979,
    z: 3001.340088,
    rx: 0,
    ry: 0,
    rzClosed: 270,
    rzOpen: 180,
    radius: 2.5,
  },
  {
    x: 1154.405029,
    y: -1358.08606,
    z: 3001.340088,
    rx: 0,
    ry: 0,
    rzClosed: 270,
    rzOpen: 180,
    radius: 2.5,
  },
];

const doors: LiveDoor[] = [];
const denyAt = new Map<number, number>();
const MOVE_SPEED = Z_BUMP / (TRAVEL_MS / 1000);

function moveDoor(door: LiveDoor, open: boolean): void {
  const { def, object } = door;
  const z = open ? def.z + Z_BUMP : def.z;
  const rz = open ? def.rzOpen : def.rzClosed;

  try {
    if (object.isMoving()) {
      object.stop();
    }
    object.move(def.x, def.y, z, MOVE_SPEED, def.rx, def.ry, rz);
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
    if (player.getInterior() !== 0 || player.getVirtualWorld() !== HOSPITAL_WORLD) {
      return null;
    }

    for (const door of doors) {
      const dist = player.getDistanceFromPoint(door.def.x, door.def.y, door.def.z);
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
  if (membership?.org.id !== ORG_HOSPITAL_ID) {
    denyOpen(player);
    return;
  }

  openDoor(door);
}

export function bindHospitalDoors(): void {
  if (doors.length > 0) {
    return;
  }

  for (const def of DOORS) {
    try {
      const object = new ObjectMp(
        19859,
        def.x,
        def.y,
        def.z,
        def.rx,
        def.ry,
        def.rzClosed,
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
