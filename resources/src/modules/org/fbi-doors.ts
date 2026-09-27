import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { AMMUNATION_INTERIOR } from "./ammunation-doors";
import { FBI_INTERIOR, ORG_FBI_ID } from "./fbi";
import { getMembership } from "./membership";

export const FBI_SERVICE_DIALOG_ID = 56;

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
const DENY = "Вы не состоите в FBI.";

type DestKey = "interior" | "roof" | "ammunation" | "street";

type FbiDoor = {
  kind: string;
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  label: string;
  staffOnly: boolean;
  dialogTitle?: string;
  dest?: SpawnPoint;
  options?: readonly { key: DestKey; label: string }[];
};

const INTERIOR_FROM_ROOF: SpawnPoint = {
  x: 288.7406,
  y: 169.2468,
  z: 1007.1719,
  angle: 359.7101,
  interior: FBI_INTERIOR,
  world: STREET_WORLD,
};

const ROOF: SpawnPoint = {
  x: 595.6833,
  y: -1474.162,
  z: 80.1563,
  angle: 357.9691,
  interior: 0,
  world: STREET_WORLD,
};

const AMMUNATION_ENTER: SpawnPoint = {
  x: 316.3595,
  y: -167.8083,
  z: 999.5938,
  angle: 0.9635,
  interior: AMMUNATION_INTERIOR,
  world: ORG_FBI_ID,
};

const DEST: Partial<Record<DestKey, SpawnPoint>> = {
  interior: INTERIOR_FROM_ROOF,
  roof: ROOF,
  ammunation: AMMUNATION_ENTER,
};

const DOORS: readonly FbiDoor[] = [
  {
    kind: "streetIn",
    pickup: { x: 607.137, y: -1458.5026, z: 14.3807, interior: 0, world: STREET_WORLD },
    dest: {
      x: 238.6755,
      y: 140.5196,
      z: 1003.0234,
      angle: 0.3367,
      interior: FBI_INTERIOR,
      world: STREET_WORLD,
    },
    label: "FBI\nСлужебный вход",
    staffOnly: true,
  },
  {
    kind: "streetOut",
    pickup: {
      x: 238.5941,
      y: 138.995,
      z: 1003.0234,
      interior: FBI_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 610.2761,
      y: -1458.6161,
      z: 14.378,
      angle: 269.6083,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: true,
  },
  {
    kind: "roofMenu",
    pickup: {
      x: 595.6104,
      y: -1476.1926,
      z: 80.1563,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "FBI\nКрыша",
    staffOnly: true,
    options: [
      { key: "interior", label: "1. Офис" },
      { key: "ammunation", label: "2. Аммунация" },
    ],
  },
  {
    kind: "interiorMenu",
    pickup: {
      x: 288.7181,
      y: 167.32,
      z: 1007.1719,
      interior: FBI_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Крыша\nАммунация",
    staffOnly: true,
    options: [
      { key: "roof", label: "1. Крыша" },
      { key: "ammunation", label: "2. Аммунация" },
    ],
  },
  {
    kind: "ammoExit",
    pickup: {
      x: 316.4231,
      y: -170.0309,
      z: 999.5938,
      interior: AMMUNATION_INTERIOR,
      world: ORG_FBI_ID,
    },
    label: "Выход",
    dialogTitle: "Выход",
    staffOnly: false,
    options: [
      { key: "roof", label: "1. Крыша" },
      { key: "interior", label: "2. Офис" },
    ],
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();
const onPickup = new Map<number, string>();
const pending = new Map<number, string>();

export function bindFbiDoors(): void {
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

  setInterval(tickFbiDoors, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== FBI_SERVICE_DIALOG_ID) {
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
    if (!door?.options) {
      return;
    }

    const option = pickOption(door, Number(listItem), String(inputText ?? ""));
    if (!option) {
      return;
    }

    const dest = DEST[option];
    if (!dest) {
      return;
    }

    // Выход из аммунации — без проверки органа (уже внутри).
    if (kind !== "ammoExit" && !canUseFbiDoor(player, true)) {
      return;
    }

    teleport(player, dest);
  });

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickFbiDoors(): void {
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
          tryUse(player, door);
          return;
        }
      }

      onPickup.delete(id);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryUse(player: Player, door: FbiDoor): void {
  if (door.staffOnly && !canUseFbiDoor(player, true)) {
    return;
  }

  if (door.options) {
    openMenu(player, door);
    return;
  }

  if (door.dest) {
    teleport(player, door.dest);
  }
}

function openMenu(player: Player, door: FbiDoor): void {
  const id = playerId(player);
  if (id === null || !door.options) {
    return;
  }

  pending.set(id, door.kind);
  try {
    Dialog.show(
      player,
      FBI_SERVICE_DIALOG_ID,
      DIALOG_STYLE_LIST,
      door.dialogTitle ?? "Служебный выход",
      door.options.map((option) => option.label).join("\n"),
      "Выбрать",
      "Отмена"
    );
  } catch {
    pending.delete(id);
    deny(player, "Не удалось открыть меню.");
  }
}

function canUseFbiDoor(player: Player, tellDeny: boolean): boolean {
  const account = getAccount(player);
  if (account?.hospitalized) {
    if (tellDeny) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
    }
    return false;
  }

  const membership = account ? getMembership(account) : null;
  if (!membership || membership.org.id !== ORG_FBI_ID) {
    if (tellDeny) {
      deny(player, DENY);
    }
    return false;
  }

  return true;
}

function pickOption(
  door: FbiDoor,
  listItem: number,
  inputText: string
): DestKey | null {
  if (!door.options) {
    return null;
  }

  const byIndex = door.options[listItem];
  if (byIndex) {
    return byIndex.key;
  }

  const raw = inputText.trim().toLowerCase();
  return (
    door.options.find(
      (option) =>
        option.label.toLowerCase() === raw ||
        option.label.replace(/^\d+\.\s*/, "").toLowerCase() === raw
    )?.key ?? null
  );
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
    onPickup.delete(id);
    pending.delete(id);
  }
}
