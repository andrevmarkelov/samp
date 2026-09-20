import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { assignStreamWorld, refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { getMembership } from "./membership";
import {
  ORG_RADIO_ID,
  RADIO_INTERIOR,
  RADIO_WORLD,
} from "./radio";

export const RADIO_DOOR_DIALOG_ID = 36;

const PICKUP_MODEL = 19132;
const PICKUP_TYPE = 1;
const DIALOG_STYLE_LIST = 2;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const DENY_COOLDOWN_MS = 2500;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const DENY_ROOF = "Na kryshu mogut tol'ko sotrudniki radiocentra.";

type DoorKind = "street" | "interior" | "roof";

type RadioDoor = {
  kind: DoorKind;
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  label: string;
  options: readonly { key: "office" | "street" | "roof"; label: string }[];
};

const OFFICE: SpawnPoint = {
  x: 1431.7196,
  y: 1056.6656,
  z: 1058.7816,
  angle: 89.4666,
  interior: RADIO_INTERIOR,
  world: RADIO_WORLD,
};

const STREET: SpawnPoint = {
  x: 1786.6143,
  y: -1297.9694,
  z: 13.375,
  angle: 1.0825,
  interior: 0,
  world: STREET_WORLD,
};

const ROOF: SpawnPoint = {
  x: 1829.1005,
  y: -1301.0917,
  z: 131.7344,
  angle: 88.5032,
  interior: 0,
  world: STREET_WORLD,
};

const DEST: Record<"office" | "street" | "roof", SpawnPoint> = {
  office: OFFICE,
  street: STREET,
  roof: ROOF,
};

const INTERIOR_MAP = {
  minX: 1390,
  maxX: 1450,
  minY: 1030,
  maxY: 1105,
  minZ: 1050,
  maxZ: 1075,
} as const;

const DOORS: readonly RadioDoor[] = [
  {
    kind: "street",
    pickup: {
      x: 1786.6016,
      y: -1300.6189,
      z: 13.5576,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Radiocentr\nVkhod",
    options: [
      { key: "office", label: "Ofis" },
      { key: "roof", label: "Krysha" },
    ],
  },
  {
    kind: "interior",
    pickup: {
      x: 1433.636,
      y: 1056.5837,
      z: 1058.7816,
      interior: RADIO_INTERIOR,
      world: RADIO_WORLD,
    },
    label: "Radiocentr\nVykhod",
    options: [
      { key: "street", label: "Ulica" },
      { key: "roof", label: "Krysha" },
    ],
  },
  {
    kind: "roof",
    pickup: {
      x: 1831.1561,
      y: -1301.1361,
      z: 131.7344,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Radiocentr\nKrysha",
    options: [
      { key: "street", label: "Ulica" },
      { key: "office", label: "Ofis" },
    ],
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();
const onPickup = new Map<number, DoorKind>();
const pending = new Map<number, DoorKind>();

export function bindRadioDoors(): void {
  assignStreamWorld(RADIO_WORLD, isRadioInteriorObject);

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

  setInterval(tickRadioDoors, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== RADIO_DOOR_DIALOG_ID) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    const kind = pending.get(id);
    pending.delete(id);
    if (!kind || Number(response) === 0) {
      return;
    }

    const door = DOORS.find((item) => item.kind === kind);
    if (!door) {
      return;
    }

    const option = pickOption(door, Number(listItem), String(inputText ?? ""));
    if (!option) {
      return;
    }

    tryUse(player, option);
  });

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickRadioDoors(): void {
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
        onPickup.delete(id);
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
          if (onPickup.get(id) === door.kind) {
            return;
          }

          onPickup.set(id, door.kind);
          openMenu(player, door);
          return;
        }
      }

      onPickup.delete(id);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function openMenu(player: Player, door: RadioDoor): void {
  const account = getAccount(player);
  if (account?.hospitalized) {
    deny(player, "Vam nuzhno lechenie. Zanimite koyku: /hospital.");
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  pending.set(id, door.kind);
  try {
    Dialog.show(
      player,
      RADIO_DOOR_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Radiocentr",
      door.options.map((option) => option.label).join("\n"),
      "Vybrat'",
      "Otmena"
    );
  } catch {
    pending.delete(id);
    deny(player, "Ne udalos' otkryt' menu.");
  }
}

function tryUse(player: Player, destKey: "office" | "street" | "roof"): void {
  const account = getAccount(player);
  if (account?.hospitalized) {
    deny(player, "Vam nuzhno lechenie. Zanimite koyku: /hospital.");
    return;
  }

  if (destKey === "roof" && !isRadioStaff(player)) {
    deny(player, DENY_ROOF);
    return;
  }

  teleport(player, DEST[destKey]);
}

function isRadioStaff(player: Player): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  return membership?.org.id === ORG_RADIO_ID;
}

function pickOption(
  door: RadioDoor,
  listItem: number,
  inputText: string
): "office" | "street" | "roof" | null {
  const byIndex = door.options[listItem];
  if (byIndex) {
    return byIndex.key;
  }

  const raw = inputText.trim().toLowerCase();
  return door.options.find((option) => option.label.toLowerCase() === raw)?.key ?? null;
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
  return distance3d(pos.x, pos.y, pos.z, point.x, point.y, point.z) <= PICKUP_RADIUS;
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

function isRadioInteriorObject(object: { x: number; y: number; z: number }): boolean {
  return (
    object.x >= INTERIOR_MAP.minX &&
    object.x <= INTERIOR_MAP.maxX &&
    object.y >= INTERIOR_MAP.minY &&
    object.y <= INTERIOR_MAP.maxY &&
    object.z >= INTERIOR_MAP.minZ &&
    object.z <= INTERIOR_MAP.maxZ
  );
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    lastTeleportAt.delete(id);
    lastDenyAt.delete(id);
    onPickup.delete(id);
    pending.delete(id);
  }
}
