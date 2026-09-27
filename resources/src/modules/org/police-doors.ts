import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { STREET_WORLD, placeAt, type SpawnPoint } from "../spawn/point";
import { AMMUNATION_INTERIOR } from "./ammunation-doors";
import { ORG_FBI_ID } from "./fbi";
import { getMembership } from "./membership";
import { LAW_ORG_IDS } from "./lspd";
import { ORG_POLICE_ID, POLICE_INTERIOR } from "./police";

export const POLICE_SERVICE_DIALOG_ID = 55;

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
const DENY = "Открыть могут сотрудники LSPD, областной полиции и FBI.";
const DENY_AMMUNATION = "В аммунацию могут войти сотрудники областной полиции и FBI.";
const AMMUNATION_ALLOWED = [ORG_POLICE_ID, ORG_FBI_ID] as const;

type DestKey = "office" | "parking" | "ammunation" | "roof";

type PoliceDoor = {
  kind: string;
  pickup: { x: number; y: number; z: number; interior: number; world: number };
  label: string;
  staffOnly: boolean;
  dialogTitle?: string;
  dest?: SpawnPoint;
  options?: readonly { key: DestKey; label: string }[];
};

const PARKING_STREET: SpawnPoint = {
  x: 611.0386,
  y: -586.416,
  z: 17.2266,
  angle: 181.2275,
  interior: 0,
  world: STREET_WORLD,
};

const OFFICE_FROM_PARKING: SpawnPoint = {
  x: 245.1678,
  y: 66.2916,
  z: 1003.6406,
  angle: 267.5659,
  interior: POLICE_INTERIOR,
  world: STREET_WORLD,
};

const OFFICE_FROM_ROOF: SpawnPoint = {
  x: 246.3152,
  y: 86.1715,
  z: 1003.6406,
  angle: 178.2883,
  interior: POLICE_INTERIOR,
  world: STREET_WORLD,
};

const ROOF: SpawnPoint = {
  x: 621.1804,
  y: -571.1289,
  z: 26.1432,
  angle: 178.1175,
  interior: 0,
  world: STREET_WORLD,
};

const AMMUNATION_ENTER: SpawnPoint = {
  x: 316.3595,
  y: -167.8083,
  z: 999.5938,
  angle: 0.9635,
  interior: AMMUNATION_INTERIOR,
  world: ORG_POLICE_ID,
};

const DEST: Record<DestKey, SpawnPoint> = {
  parking: PARKING_STREET,
  ammunation: AMMUNATION_ENTER,
  roof: ROOF,
  office: OFFICE_FROM_ROOF,
};

const DOORS: readonly PoliceDoor[] = [
  {
    kind: "mainIn",
    pickup: { x: 626.973, y: -571.7709, z: 17.9207, interior: 0, world: STREET_WORLD },
    dest: {
      x: 246.66,
      y: 65.8,
      z: 1003.64,
      angle: 0,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    label: "Областная полиция\nВход",
    staffOnly: false,
  },
  {
    kind: "mainOut",
    pickup: {
      x: 246.757,
      y: 62.4475,
      z: 1003.6406,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    dest: {
      x: 631.6352,
      y: -571.7485,
      z: 16.3359,
      angle: 268.9851,
      interior: 0,
      world: STREET_WORLD,
    },
    label: "Выход на улицу",
    staffOnly: false,
  },
  {
    kind: "parkingIn",
    pickup: { x: 611.0726, y: -583.5037, z: 18.2109, interior: 0, world: STREET_WORLD },
    dest: OFFICE_FROM_PARKING,
    label: "Парковка\nСлужебный вход",
    staffOnly: true,
  },
  {
    kind: "parkingOut",
    pickup: {
      x: 242.477,
      y: 66.3774,
      z: 1003.6406,
      interior: POLICE_INTERIOR,
      world: STREET_WORLD,
    },
    dest: PARKING_STREET,
    label: "Парковка\nСлужебный выход",
    staffOnly: true,
  },
  {
    kind: "roofMenu",
    pickup: { x: 621.258, y: -569.2031, z: 26.1432, interior: 0, world: STREET_WORLD },
    label: "Полиция\nКрыша",
    staffOnly: true,
    options: [
      { key: "office", label: "1. Офис" },
      { key: "ammunation", label: "2. Аммунация" },
    ],
  },
  {
    kind: "interiorMenu",
    pickup: {
      x: 246.3991,
      y: 88.0064,
      z: 1003.6406,
      interior: POLICE_INTERIOR,
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
      world: ORG_POLICE_ID,
    },
    label: "Выход",
    dialogTitle: "Выход",
    staffOnly: false,
    options: [
      { key: "roof", label: "1. Крыша" },
      { key: "office", label: "2. Офис" },
    ],
  },
];

const lastTeleportAt = new Map<number, number>();
const lastDenyAt = new Map<number, number>();
const onPickup = new Map<number, string>();
const pending = new Map<number, string>();

export function bindPoliceDoors(): void {
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

  setInterval(tickPoliceDoors, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== POLICE_SERVICE_DIALOG_ID) {
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
    if (kind !== "ammoExit" && !canUseStaffDoor(player, true)) {
      return;
    }

    if (option === "ammunation" && !canEnterAmmunation(player, true)) {
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

function tickPoliceDoors(): void {
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

function tryUse(player: Player, door: PoliceDoor): void {
  if (door.staffOnly && !canUseStaffDoor(player, true)) {
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

function openMenu(player: Player, door: PoliceDoor): void {
  const id = playerId(player);
  if (id === null || !door.options) {
    return;
  }

  pending.set(id, door.kind);
  try {
    Dialog.show(
      player,
      POLICE_SERVICE_DIALOG_ID,
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

function canUseStaffDoor(player: Player, tellDeny: boolean): boolean {
  const account = getAccount(player);
  if (account?.hospitalized) {
    if (tellDeny) {
      deny(player, "Вам нужно лечение. Займите койку: /hospital.");
    }
    return false;
  }

  const membership = account ? getMembership(account) : null;
  const orgId = membership?.org.id;
  if (orgId === undefined || !(LAW_ORG_IDS as readonly number[]).includes(orgId)) {
    if (tellDeny) {
      deny(player, DENY);
    }
    return false;
  }

  return true;
}

function canEnterAmmunation(player: Player, tellDeny: boolean): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  const orgId = membership?.org.id;
  if (orgId === undefined || !(AMMUNATION_ALLOWED as readonly number[]).includes(orgId)) {
    if (tellDeny) {
      deny(player, DENY_AMMUNATION);
    }
    return false;
  }

  return true;
}

function pickOption(
  door: PoliceDoor,
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
