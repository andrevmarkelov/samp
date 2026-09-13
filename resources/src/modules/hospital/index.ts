import { omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserHospitalized } from "../auth/repository";
import {
  MAX_HEALTH,
  applyHealth,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { queueSave } from "../persist";
import { refreshStreamForPlayer } from "../mapping/stream";
import type { GameModule } from "../types";
import {
  HOSPITAL_WORLD,
  STREET_WORLD,
  placeAt,
  type SpawnPoint,
} from "../spawn/point";

const PICKUP_MODEL = 19132;
const BED_PICKUP_MODEL = 1240;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const TELEPORT_COOLDOWN_MS = 1500;
const PICKUP_RADIUS = 1.5;
const BED_USE_RADIUS = 2;
const TICK_MS = 200;
const HEAL_MS = 4500;
const HEAL_AMOUNT = 10;
const HOSPITAL_MAP_ICON_SLOT = 0;
const HOSPITAL_MAP_ICON_TYPE = 22;
const MAPICON_LOCAL = 0;
const ICON_RADIUS = 300;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const BED_LABEL_DRAW_DISTANCE = 5;
const BED_LABEL_HEIGHT = 1.18;
const BED_LABEL_LINE = 0.1;

type BedLabelSet = {
  title: TextLabel;
  status: TextLabel;
  hint: TextLabel;
};

const STREET_PICKUP = {
  x: 1172.8518,
  y: -1323.344,
  z: 15.3998,
} as const;

const INTERIOR_PICKUP = {
  x: 1607.174,
  y: 1810.1447,
  z: -20.7665,
} as const;

const FROM_STREET: SpawnPoint = {
  x: 1607.1842,
  y: 1807.3461,
  z: -20.7645,
  angle: 179.9952,
  interior: 0,
  world: HOSPITAL_WORLD,
};

const FROM_INTERIOR: SpawnPoint = {
  x: 1177.4657,
  y: -1323.7079,
  z: 14.0721,
  angle: 270.3613,
  interior: 0,
  world: STREET_WORLD,
};

const BEDS: readonly SpawnPoint[] = [
  { x: 1597.9979, y: 1804.3722, z: -20.7924, angle: 269.3663, interior: 0, world: HOSPITAL_WORLD },
  { x: 1597.9989, y: 1806.8933, z: -20.7924, angle: 269.9929, interior: 0, world: HOSPITAL_WORLD },
  { x: 1597.9972, y: 1809.387, z: -20.7924, angle: 270.6196, interior: 0, world: HOSPITAL_WORLD },
  { x: 1593.9376, y: 1810.5353, z: -20.7924, angle: 90.788, interior: 0, world: HOSPITAL_WORLD },
  { x: 1593.9384, y: 1808.0323, z: -20.7924, angle: 90.7879, interior: 0, world: HOSPITAL_WORLD },
  { x: 1593.9371, y: 1805.5417, z: -20.7924, angle: 91.7279, interior: 0, world: HOSPITAL_WORLD },
  { x: 1587.9996, y: 1804.3844, z: -20.7924, angle: 269.0529, interior: 0, world: HOSPITAL_WORLD },
  { x: 1587.9966, y: 1806.8986, z: -20.7924, angle: 269.3662, interior: 0, world: HOSPITAL_WORLD },
  { x: 1587.9971, y: 1809.3759, z: -20.7924, angle: 271.8729, interior: 0, world: HOSPITAL_WORLD },
  { x: 1583.9344, y: 1810.5408, z: -20.7924, angle: 88.5712, interior: 0, world: HOSPITAL_WORLD },
  { x: 1583.9381, y: 1808.0299, z: -20.7924, angle: 89.8245, interior: 0, world: HOSPITAL_WORLD },
  { x: 1583.9341, y: 1805.5366, z: -20.7924, angle: 90.1378, interior: 0, world: HOSPITAL_WORLD },
  { x: 1578.0, y: 1804.3511, z: -20.7924, angle: 270.5962, interior: 0, world: HOSPITAL_WORLD },
  { x: 1578.0, y: 1806.8785, z: -20.7924, angle: 269.6563, interior: 0, world: HOSPITAL_WORLD },
  { x: 1578.0009, y: 1809.3735, z: -20.7924, angle: 269.3429, interior: 0, world: HOSPITAL_WORLD },
  { x: 1573.9343, y: 1810.5559, z: -20.7924, angle: 90.4513, interior: 0, world: HOSPITAL_WORLD },
  { x: 1573.9373, y: 1808.0479, z: -20.7924, angle: 90.1379, interior: 0, world: HOSPITAL_WORLD },
  { x: 1573.9379, y: 1805.5472, z: -20.7924, angle: 89.1979, interior: 0, world: HOSPITAL_WORLD },
];

const lastTeleportAt = new Map<number, number>();
const lastExitMsgAt = new Map<number, number>();
const iconShown = new Set<number>();
const bedByPlayer = new Map<number, number>();
const occupantByBed: Array<number | null> = BEDS.map(() => null);
const bedLabels: BedLabelSet[] = [];
let lastHealAt = 0;

export const hospitalModule: GameModule = {
  name: "hospital",
  start() {
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      STREET_PICKUP.x,
      STREET_PICKUP.y,
      STREET_PICKUP.z,
      STREET_WORLD
    );
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      INTERIOR_PICKUP.x,
      INTERIOR_PICKUP.y,
      INTERIOR_PICKUP.z,
      HOSPITAL_WORLD
    );

    createPickupLabel(STREET_PICKUP, STREET_WORLD, "Gorodskaya bolnica\nVkhod");
    createPickupLabel(INTERIOR_PICKUP, HOSPITAL_WORLD, "Vykhod na ulicu");

    for (let i = 0; i < BEDS.length; i++) {
      const bed = BEDS[i];
      if (!bed) {
        continue;
      }

      new Pickup(BED_PICKUP_MODEL, PICKUP_TYPE, bed.x, bed.y, bed.z, HOSPITAL_WORLD);
      bedLabels[i] = createBedLabels(bed, i);
    }

    setInterval(tickHospital, TICK_MS);

    omp.on("playerConnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        lastTeleportAt.delete(id);
        lastExitMsgAt.delete(id);
        iconShown.delete(id);
        releaseBed(id);
      }
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        lastTeleportAt.delete(id);
        lastExitMsgAt.delete(id);
        iconShown.delete(id);
        releaseBed(id);
      }
    });
  },
};

export function tryOccupyHospitalBed(player: Player): void {
  if (!isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const account = getAccount(player);
  if (!account?.hospitalized) {
    player.sendClientMessage(Color.error, "Vam ne nuzhno lechenie.");
    return;
  }

  if (bedByPlayer.has(id)) {
    player.sendClientMessage(Color.gray, "Vy uzhe lezhite na koyke.");
    return;
  }

  let pos;
  let world = 0;
  try {
    pos = player.getPos();
    world = player.getVirtualWorld();
  } catch {
    return;
  }

  if (world !== HOSPITAL_WORLD) {
    player.sendClientMessage(Color.error, "Koyki tol'ko v bolnice.");
    return;
  }

  let nearestFree = -1;
  let nearestFreeDist = BED_USE_RADIUS;
  let nearestBusyName: string | null = null;
  let nearestBusyDist = BED_USE_RADIUS;

  for (let i = 0; i < BEDS.length; i++) {
    const bed = BEDS[i];
    if (!bed) {
      continue;
    }

    const dist = distance3d(pos.x, pos.y, pos.z, bed.x, bed.y, bed.z);
    const occupant = occupantByBed[i];
    if (occupant === null) {
      if (dist <= nearestFreeDist) {
        nearestFreeDist = dist;
        nearestFree = i;
      }
      continue;
    }

    if (dist <= nearestBusyDist) {
      nearestBusyDist = dist;
      const other = getAccountBySlot(occupant);
      nearestBusyName = other?.name ?? "Igrok";
    }
  }

  if (nearestFree >= 0) {
    occupyBed(player, id, nearestFree);
    return;
  }

  if (nearestBusyName) {
    player.sendClientMessage(Color.error, `Koyka zanyata: ${nearestBusyName}.`);
    return;
  }

  player.sendClientMessage(Color.error, "Podoydite k svobodnoy koyke.");
}

function occupyBed(player: Player, playerSlot: number, bedIndex: number): void {
  const bed = BEDS[bedIndex];
  if (!bed) {
    return;
  }

  occupantByBed[bedIndex] = playerSlot;
  bedByPlayer.set(playerSlot, bedIndex);
  updateBedLabel(bedIndex);

  try {
    placeAt(player, bed);
  } catch {
    releaseBed(playerSlot);
    return;
  }

  player.sendClientMessage(
    Color.info,
    `Vy zanyali koyku №${bedIndex + 1}. Lechenie nachalos'.`
  );
}

function releaseBed(playerSlot: number): void {
  const bedIndex = bedByPlayer.get(playerSlot);
  if (bedIndex === undefined) {
    return;
  }

  bedByPlayer.delete(playerSlot);
  if (occupantByBed[bedIndex] === playerSlot) {
    occupantByBed[bedIndex] = null;
    updateBedLabel(bedIndex);
  }
}

function finishTreatment(player: Player, playerSlot: number): void {
  releaseBed(playerSlot);

  const account = getAccount(player);
  patchAccount(player, { health: MAX_HEALTH, hospitalized: false });
  applyHealth(player, MAX_HEALTH);
  if (account) {
    void saveUserHospitalized(account.id, false, MAX_HEALTH);
    queueSave(player);
  }

  player.sendClientMessage(Color.info, "Lechenie zaversheno. Mozhete vyti na ulicu.");
}

function getAccountBySlot(slot: number): ReturnType<typeof getAccount> {
  let found: ReturnType<typeof getAccount> = null;
  omp.players.forEach((player) => {
    if (playerId(player) === slot) {
      found = getAccount(player);
    }
  });
  return found;
}

function createBedLabels(bed: SpawnPoint, index: number): BedLabelSet {
  const title = new TextLabel(
    `Koika №${index + 1}`,
    Color.white,
    bed.x,
    bed.y,
    bed.z + BED_LABEL_HEIGHT,
    BED_LABEL_DRAW_DISTANCE,
    HOSPITAL_WORLD,
    false
  );
  const status = new TextLabel(
    "Svobodna",
    Color.tryOk,
    bed.x,
    bed.y,
    bed.z + BED_LABEL_HEIGHT - BED_LABEL_LINE,
    BED_LABEL_DRAW_DISTANCE,
    HOSPITAL_WORLD,
    false
  );
  const hint = new TextLabel(
    "/hospital",
    Color.gray,
    bed.x,
    bed.y,
    bed.z + BED_LABEL_HEIGHT - BED_LABEL_LINE * 2,
    BED_LABEL_DRAW_DISTANCE,
    HOSPITAL_WORLD,
    false
  );

  return { title, status, hint };
}

function updateBedLabel(index: number): void {
  const labels = bedLabels[index];
  if (!labels) {
    return;
  }

  const occupant = occupantByBed[index];
  const name = occupant === null ? null : getAccountBySlot(occupant)?.name ?? "Igrok";

  try {
    if (name) {
      labels.status.updateText(Color.error, `Zanyata: ${name}`);
      labels.hint.updateText(Color.gray, " ");
    } else {
      labels.status.updateText(Color.tryOk, "Svobodna");
      labels.hint.updateText(Color.gray, "/hospital");
    }
  } catch {
    // Лейбл уже уничтожен.
  }
}

function createPickupLabel(
  at: { x: number; y: number; z: number },
  world: number,
  text: string
): void {
  new TextLabel(
    text,
    Color.info,
    at.x,
    at.y,
    at.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );
}

function tickHospital(): void {
  const now = Date.now();
  if (now - lastHealAt >= HEAL_MS) {
    lastHealAt = now;
    healOccupiedBeds();
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const world = player.getVirtualWorld();
      const state = player.getState();
      updateHospitalIcon(player, pos.x, pos.y, world);

      if (state !== PLAYER_STATE_ONFOOT) {
        return;
      }

      if (
        world === STREET_WORLD &&
        distance3d(pos.x, pos.y, pos.z, STREET_PICKUP.x, STREET_PICKUP.y, STREET_PICKUP.z) <=
          PICKUP_RADIUS
      ) {
        teleport(player, FROM_STREET);
        return;
      }

      if (
        world === HOSPITAL_WORLD &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          INTERIOR_PICKUP.x,
          INTERIOR_PICKUP.y,
          INTERIOR_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        tryLeaveHospital(player);
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function healOccupiedBeds(): void {
  omp.players.forEach((player) => {
    const id = playerId(player);
    if (id === null || !isPlayerActive(player)) {
      return;
    }

    const bedIndex = bedByPlayer.get(id);
    const bed = bedIndex === undefined ? undefined : BEDS[bedIndex];
    if (bedIndex === undefined || !bed) {
      return;
    }

    const account = getAccount(player);
    if (!account?.hospitalized) {
      releaseBed(id);
      return;
    }

    try {
      const pos = player.getPos();
      if (player.getVirtualWorld() !== HOSPITAL_WORLD) {
        releaseBed(id);
        return;
      }

      if (distance3d(pos.x, pos.y, pos.z, bed.x, bed.y, bed.z) > BED_USE_RADIUS) {
        releaseBed(id);
        player.sendClientMessage(Color.gray, "Vy vstali s koyki. Lechenie ostanovleno.");
        return;
      }
    } catch {
      return;
    }

    let live = account.health;
    try {
      live = player.getHealth();
    } catch {
      // Берём из аккаунта.
    }

    const next = Math.min(MAX_HEALTH, live + HEAL_AMOUNT);
    applyHealth(player, next);
    patchAccount(player, { health: next });

    if (next >= MAX_HEALTH) {
      finishTreatment(player, id);
    }
  });
}

function tryLeaveHospital(player: Player): void {
  const account = getAccount(player);
  if (account?.hospitalized) {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    const now = Date.now();
    const last = lastExitMsgAt.get(id) ?? 0;
    if (now - last < TELEPORT_COOLDOWN_MS) {
      return;
    }

    lastExitMsgAt.set(id, now);
    player.sendClientMessage(
      Color.error,
      "Vam nuzhno lechenie. Zanimite koyku: /hospital."
    );
    return;
  }

  teleport(player, FROM_INTERIOR);
}

function updateHospitalIcon(
  player: Player,
  x: number,
  y: number,
  world: number
): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const nearStreet =
    world === STREET_WORLD &&
    distance2d(x, y, STREET_PICKUP.x, STREET_PICKUP.y) <= ICON_RADIUS;

  if (nearStreet) {
    if (iconShown.has(id)) {
      return;
    }

    try {
      player.setMapIcon(
        HOSPITAL_MAP_ICON_SLOT,
        STREET_PICKUP.x,
        STREET_PICKUP.y,
        STREET_PICKUP.z,
        HOSPITAL_MAP_ICON_TYPE,
        0,
        MAPICON_LOCAL
      );
      iconShown.add(id);
    } catch {
      // Игрок уже вышел.
    }
    return;
  }

  if (!iconShown.has(id)) {
    return;
  }

  try {
    player.removeMapIcon(HOSPITAL_MAP_ICON_SLOT);
  } catch {
    // Игрок уже вышел.
  }
  iconShown.delete(id);
}

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
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
