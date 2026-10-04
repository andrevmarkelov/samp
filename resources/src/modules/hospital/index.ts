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
/** Звук тика лечения (PlayerPlaySound). */
const HEAL_SOUND_ID = 17803;
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
  x: 1176.376,
  y: -1330.9333,
  z: 4001.1001,
} as const;

const FROM_STREET: SpawnPoint = {
  x: 1172.933,
  y: -1330.9065,
  z: 4001.1001,
  angle: 89.6127,
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

/** Холл приёмного → служебный блок (кадры, оперблок, руководство…). */
const HALL_TO_SERVICE_PICKUP = {
  x: 1165.1902,
  y: -1322.7876,
  z: 4001.1001,
} as const;

const TO_SERVICE_BLOCK: SpawnPoint = {
  x: 1151.0358,
  y: -1364.811,
  z: 3001.0845,
  angle: 1.2748,
  interior: 0,
  world: HOSPITAL_WORLD,
};

/** Служебный блок → холл приёмного. */
const SERVICE_TO_HALL_PICKUP = {
  x: 1151.0732,
  y: -1366.5275,
  z: 3001.0845,
} as const;

const TO_RECEPTION_HALL: SpawnPoint = {
  x: 1165.1576,
  y: -1324.4823,
  z: 4001.1001,
  angle: 179.5168,
  interior: 0,
  world: HOSPITAL_WORLD,
};

const BEDS: readonly SpawnPoint[] = [
  { x: 1172.7423, y: -1342.6758, z: 4001.1001, angle: 0.2888, interior: 0, world: HOSPITAL_WORLD },
  { x: 1174.9169, y: -1342.6736, z: 4001.1001, angle: 358.7221, interior: 0, world: HOSPITAL_WORLD },
  { x: 1174.8799, y: -1346.8517, z: 4001.1001, angle: 180.4572, interior: 0, world: HOSPITAL_WORLD },
  { x: 1172.7137, y: -1346.851, z: 4001.1001, angle: 180.1438, interior: 0, world: HOSPITAL_WORLD },
  { x: 1172.7706, y: -1352.4978, z: 4001.1001, angle: 359.3722, interior: 0, world: HOSPITAL_WORLD },
  { x: 1174.8793, y: -1352.5005, z: 4001.1001, angle: 359.3722, interior: 0, world: HOSPITAL_WORLD },
  { x: 1174.8811, y: -1356.6752, z: 4001.1001, angle: 179.5406, interior: 0, world: HOSPITAL_WORLD },
  { x: 1172.7496, y: -1356.6752, z: 4001.1001, angle: 179.5406, interior: 0, world: HOSPITAL_WORLD },
  { x: 1169.9792, y: -1364.0752, z: 4001.1001, angle: 178.9139, interior: 0, world: HOSPITAL_WORLD },
  { x: 1165.1626, y: -1364.0757, z: 4001.1001, angle: 180.4806, interior: 0, world: HOSPITAL_WORLD },
  { x: 1160.39, y: -1364.0764, z: 4001.1001, angle: 179.8539, interior: 0, world: HOSPITAL_WORLD },
  { x: 1157.639, y: -1356.6758, z: 4001.1001, angle: 179.564, interior: 0, world: HOSPITAL_WORLD },
  { x: 1155.4634, y: -1356.6747, z: 4001.1001, angle: 180.1907, interior: 0, world: HOSPITAL_WORLD },
  { x: 1155.493, y: -1352.498, z: 4001.1001, angle: 358.7924, interior: 0, world: HOSPITAL_WORLD },
  { x: 1157.6072, y: -1352.4983, z: 4001.1001, angle: 0.359, interior: 0, world: HOSPITAL_WORLD },
  { x: 1157.6229, y: -1346.8712, z: 4001.1001, angle: 181.7808, interior: 0, world: HOSPITAL_WORLD },
  { x: 1155.475, y: -1346.8712, z: 4001.1001, angle: 179.9008, interior: 0, world: HOSPITAL_WORLD },
  { x: 1155.4849, y: -1342.6945, z: 4001.1001, angle: 0.0692, interior: 0, world: HOSPITAL_WORLD },
  { x: 1157.6219, y: -1342.6943, z: 4001.1001, angle: 0.3825, interior: 0, world: HOSPITAL_WORLD },
];

const lastTeleportAt = new Map<number, number>();
const lastExitMsgAt = new Map<number, number>();
const iconShown = new Set<number>();
/** Слот → индекс койки (пока лежит на ней). */
const bedByPlayer = new Map<number, number>();
/** Слоты, начавшие лечение через /hospital — ходят по интерьеру, пока hospitalized. */
const treatingPlayers = new Set<number>();
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

    createPickupLabel(STREET_PICKUP, STREET_WORLD, "Городская больница\nВход");
    createPickupLabel(INTERIOR_PICKUP, HOSPITAL_WORLD, "Выход на улицу");

    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      HALL_TO_SERVICE_PICKUP.x,
      HALL_TO_SERVICE_PICKUP.y,
      HALL_TO_SERVICE_PICKUP.z,
      HOSPITAL_WORLD
    );
    new Pickup(
      PICKUP_MODEL,
      PICKUP_TYPE,
      SERVICE_TO_HALL_PICKUP.x,
      SERVICE_TO_HALL_PICKUP.y,
      SERVICE_TO_HALL_PICKUP.z,
      HOSPITAL_WORLD
    );
    createPickupLabel(HALL_TO_SERVICE_PICKUP, HOSPITAL_WORLD, "Служебный блок\nВход");
    createPickupLabel(SERVICE_TO_HALL_PICKUP, HOSPITAL_WORLD, "Приёмный холл\nВыход");

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
      clearHospitalSlot(player);
    });

    omp.on("playerDisconnect", (player) => {
      clearHospitalSlot(player);
    });

    // Смерть сбрасывает сессию койки — после респавна снова нужен /hospital.
    omp.on("playerDeath", (player) => {
      clearHospitalSlot(player);
    });
  },
};

/**
 * Снять hospitalized после внешнего полного лечения (/medhelp и т.п.).
 * Иначе пациент с 100 HP остаётся заперт в интерьере.
 */
export function dischargeHospitalPatient(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    releaseBed(id);
    treatingPlayers.delete(id);
  }

  const account = getAccount(player);
  if (!account?.hospitalized) {
    return;
  }

  patchAccount(player, { hospitalized: false });
  void saveUserHospitalized(account.id, false, account.health);
  queueSave(player);
}

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
    player.sendClientMessage(Color.error, "Вам не нужно лечение.");
    return;
  }

  if (treatingPlayers.has(id)) {
    player.sendClientMessage(
      Color.gray,
      "Лечение уже идёт. Можете ходить по больнице; на улицу — после выздоровления."
    );
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
    player.sendClientMessage(Color.error, "Койки только в больнице.");
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
      nearestBusyName = other?.name ?? "Игрок";
    }
  }

  if (nearestFree >= 0) {
    occupyBed(player, id, nearestFree);
    return;
  }

  if (nearestBusyName) {
    player.sendClientMessage(Color.error, `Койка занята: ${nearestBusyName}.`);
    return;
  }

  player.sendClientMessage(Color.error, "Подойдите к свободной койке.");
}

function occupyBed(player: Player, playerSlot: number, bedIndex: number): void {
  const bed = BEDS[bedIndex];
  if (!bed) {
    return;
  }

  occupantByBed[bedIndex] = playerSlot;
  bedByPlayer.set(playerSlot, bedIndex);
  treatingPlayers.add(playerSlot);
  updateBedLabel(bedIndex);

  try {
    placeAt(player, bed, { settleMs: false });
  } catch {
    releaseBed(playerSlot);
    treatingPlayers.delete(playerSlot);
    return;
  }

  player.sendClientMessage(
    Color.info,
    `Вы заняли койку №${bedIndex + 1}. Лечение началось.`
  );
  player.sendClientMessage(
    Color.gray,
    "Можете ходить по больнице. На улицу — после выздоровления."
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
  treatingPlayers.delete(playerSlot);

  const account = getAccount(player);
  patchAccount(player, { health: MAX_HEALTH, hospitalized: false });
  applyHealth(player, MAX_HEALTH);
  if (account) {
    void saveUserHospitalized(account.id, false, MAX_HEALTH);
    queueSave(player);
  }

  player.sendClientMessage(Color.info, "Лечение завершено. Можете выйти на улицу.");
}

function clearHospitalSlot(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  lastTeleportAt.delete(id);
  lastExitMsgAt.delete(id);
  iconShown.delete(id);
  treatingPlayers.delete(id);
  releaseBed(id);
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
    `Койка №${index + 1}`,
    Color.white,
    bed.x,
    bed.y,
    bed.z + BED_LABEL_HEIGHT,
    BED_LABEL_DRAW_DISTANCE,
    HOSPITAL_WORLD,
    false
  );
  const status = new TextLabel(
    "Свободна",
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
  const name = occupant === null ? null : getAccountBySlot(occupant)?.name ?? "Игрок";

  try {
    if (name) {
      labels.status.updateText(Color.error, `Занята: ${name}`);
      labels.hint.updateText(Color.gray, " ");
    } else {
      labels.status.updateText(Color.tryOk, "Свободна");
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
    healTreatingPatients();
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
        return;
      }

      if (
        world === HOSPITAL_WORLD &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          HALL_TO_SERVICE_PICKUP.x,
          HALL_TO_SERVICE_PICKUP.y,
          HALL_TO_SERVICE_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        teleport(player, TO_SERVICE_BLOCK);
        return;
      }

      if (
        world === HOSPITAL_WORLD &&
        distance3d(
          pos.x,
          pos.y,
          pos.z,
          SERVICE_TO_HALL_PICKUP.x,
          SERVICE_TO_HALL_PICKUP.y,
          SERVICE_TO_HALL_PICKUP.z
        ) <= PICKUP_RADIUS
      ) {
        teleport(player, TO_RECEPTION_HALL);
      }
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function healTreatingPatients(): void {
  if (treatingPlayers.size === 0) {
    return;
  }

  for (const id of [...treatingPlayers]) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      treatingPlayers.delete(id);
      releaseBed(id);
      continue;
    }

    const account = getAccount(player);
    if (!account?.hospitalized) {
      treatingPlayers.delete(id);
      releaseBed(id);
      continue;
    }

    try {
      if (player.getVirtualWorld() !== HOSPITAL_WORLD) {
        // Выход из VW без улицы (админ и т.п.) — койку освобождаем, лечение на паузе.
        releaseBed(id);
        continue;
      }

      const bedIndex = bedByPlayer.get(id);
      const bed = bedIndex === undefined ? undefined : BEDS[bedIndex];
      if (bed) {
        const pos = player.getPos();
        if (distance3d(pos.x, pos.y, pos.z, bed.x, bed.y, bed.z) > BED_USE_RADIUS) {
          // Отошёл от койки — можно ходить по интерьеру, лечение продолжается.
          releaseBed(id);
        }
      }
    } catch {
      continue;
    }

    let live = account.health;
    try {
      live = player.getHealth();
    } catch {
      // Берём из аккаунта.
    }

    const next = Math.min(MAX_HEALTH, live + HEAL_AMOUNT);
    if (next <= live) {
      if (next >= MAX_HEALTH) {
        finishTreatment(player, id);
      }
      continue;
    }

    applyHealth(player, next);
    patchAccount(player, { health: next });
    try {
      player.playGameSound(HEAL_SOUND_ID, 0, 0, 0);
    } catch {
      // Слот пустой.
    }

    if (next >= MAX_HEALTH) {
      finishTreatment(player, id);
    }
  }
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
      treatingPlayers.has(id)
        ? "Лечение ещё не закончено. На улицу — после выздоровления."
        : "Вам нужно лечение. Займите койку: /hospital."
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
