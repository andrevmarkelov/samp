import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { trustHealth } from "../anticheat/trust";
import { saveUserHospitalized, saveUserJailedSeconds } from "../auth/repository";
import {
  MAX_HEALTH,
  getAccount,
  isAuthenticated,
  patchAccount,
  type Account,
} from "../auth/session";
import { refreshStreamForPlayer } from "../mapping/stream";
import { applyOrgVisuals } from "../org/appearance";
import { resolveOrgSpawn } from "../org/membership";
import {
  DEFAULT_SPAWN,
  PRISON_WORLD,
  PRISON_YARD_WORLD,
  STREET_WORLD,
  placeAt,
  type SpawnPoint,
} from "../spawn/point";

const SAVE_EVERY_MS = 30_000;
const TICK_MS = 1000;
const INMATE_DENY = "Вы отбываете срок. Этот выход закрыт.";

const CELLS: readonly SpawnPoint[] = [
  { x: -86.0985, y: 2444.3215, z: 1179.3195, angle: 179.9293, interior: 0, world: PRISON_WORLD },
  { x: -80.0605, y: 2444.24, z: 1179.3195, angle: 179.9528, interior: 0, world: PRISON_WORLD },
  { x: -74.8285, y: 2444.2334, z: 1179.3195, angle: 177.7828, interior: 0, world: PRISON_WORLD },
  { x: -69.623, y: 2444.2744, z: 1179.3195, angle: 178.0962, interior: 0, world: PRISON_WORLD },
  { x: -64.4641, y: 2444.2153, z: 1179.3195, angle: 178.4329, interior: 0, world: PRISON_WORLD },
  { x: -64.4038, y: 2424.6968, z: 1179.3195, angle: 0.1679, interior: 0, world: PRISON_WORLD },
  { x: -69.6661, y: 2425.2454, z: 1179.3195, angle: 359.2513, interior: 0, world: PRISON_WORLD },
  { x: -74.9754, y: 2424.3108, z: 1179.3195, angle: 0.2147, interior: 0, world: PRISON_WORLD },
  { x: -80.0758, y: 2424.968, z: 1179.3195, angle: 0.5513, interior: 0, world: PRISON_WORLD },
  { x: -86.0648, y: 2425.0808, z: 1179.3195, angle: 358.6947, interior: 0, world: PRISON_WORLD },
  { x: -88.2819, y: 2446.0017, z: 1183.1563, angle: 177.6097, interior: 0, world: PRISON_WORLD },
  { x: -82.1561, y: 2446.1208, z: 1183.1563, angle: 176.3798, interior: 0, world: PRISON_WORLD },
  { x: -76.8797, y: 2445.8909, z: 1183.1563, angle: 177.0299, interior: 0, world: PRISON_WORLD },
  { x: -71.6672, y: 2446.1223, z: 1183.1563, angle: 176.74, interior: 0, world: PRISON_WORLD },
  { x: -66.4491, y: 2445.8845, z: 1183.1563, angle: 177.7034, interior: 0, world: PRISON_WORLD },
  { x: -66.7806, y: 2423.917, z: 1183.1563, angle: 357.8718, interior: 0, world: PRISON_WORLD },
  { x: -71.9063, y: 2423.8521, z: 1183.1563, angle: 359.7751, interior: 0, world: PRISON_WORLD },
  { x: -77.1794, y: 2423.2886, z: 1183.1563, angle: 358.2318, interior: 0, world: PRISON_WORLD },
  { x: -82.3768, y: 2423.6826, z: 1183.1563, angle: 358.5685, interior: 0, world: PRISON_WORLD },
  { x: -88.5558, y: 2423.5215, z: 1183.1563, angle: 357.3385, interior: 0, world: PRISON_WORLD },
];

const FREEDOM: SpawnPoint = {
  x: 1806.3599,
  y: -1574.079,
  z: 13.4466,
  angle: 300.3153,
  interior: 0,
  world: STREET_WORLD,
};

const lastSavedAt = new Map<number, number>();

export const JAIL_INMATE_DENY = INMATE_DENY;

export function isJailed(player: Player): boolean {
  const account = getAccount(player);
  return account !== null && isJailedAccount(account);
}

export function isJailedAccount(account: Account | null | undefined): boolean {
  return (account?.jailSeconds ?? 0) > 0;
}

export function pickJailCell(): SpawnPoint {
  const first = CELLS[0];
  if (!first) {
    return FREEDOM;
  }

  const index = Math.floor(Math.random() * CELLS.length);
  return CELLS[index] ?? first;
}

export function placeInJail(player: Player): void {
  try {
    try {
      if (player.isInAnyVehicle()) {
        player.removeFromVehicle();
      }
    } catch {
      // Пешком.
    }

    placeAt(player, pickJailCell());
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

export async function applyJail(player: Player, minutes: number): Promise<boolean> {
  const account = getAccount(player);
  if (!account || isJailedAccount(account)) {
    return false;
  }

  const previousHospitalized = account.hospitalized;
  const previousHealth = account.health;
  const seconds = Math.max(1, Math.floor(minutes)) * 60;
  patchAccount(player, {
    jailSeconds: seconds,
    hospitalized: false,
    health: MAX_HEALTH,
  });

  try {
    await saveUserJailedSeconds(account.id, seconds);
    await saveUserHospitalized(account.id, false, MAX_HEALTH);
  } catch {
    patchAccount(player, {
      jailSeconds: 0,
      hospitalized: previousHospitalized,
      health: previousHealth,
    });
    return false;
  }

  const id = playerId(player);
  if (id !== null) {
    lastSavedAt.set(id, Date.now());
  }

  try {
    player.setHealth(MAX_HEALTH);
    trustHealth(player, MAX_HEALTH);
  } catch {
    // Слот ещё не готов.
  }

  placeInJail(player);
  applyOrgVisuals(player);
  tell(player, Color.error, `Вас посадили в тюрьму. Срок: ${minutes} мин.`);
  return true;
}

export async function applyUnjail(player: Player): Promise<boolean> {
  const account = getAccount(player);
  if (!account || !isJailedAccount(account)) {
    return false;
  }

  const previous = account.jailSeconds;
  patchAccount(player, { jailSeconds: 0 });

  try {
    await saveUserJailedSeconds(account.id, 0);
  } catch {
    patchAccount(player, { jailSeconds: previous });
    return false;
  }

  const id = playerId(player);
  if (id !== null) {
    lastSavedAt.delete(id);
  }

  placeAtSpawn(player, resolveOrgSpawn(account) ?? DEFAULT_SPAWN);
  applyOrgVisuals(player);
  tell(player, Color.info, "Вас выпустили из тюрьмы.");
  return true;
}

export function bindJailSentence(): void {
  setInterval(tickJail, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    persistJail(player, true);
    const id = playerId(player);
    if (id !== null) {
      lastSavedAt.delete(id);
    }
  });
}

function tickJail(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.jailSeconds <= 0) {
      return;
    }

    const next = account.jailSeconds - 1;
    if (next <= 0) {
      void releaseFromJail(player);
      return;
    }

    patchAccount(player, { jailSeconds: next });
    confineInmate(player);

    const id = playerId(player);
    if (id === null) {
      return;
    }

    const last = lastSavedAt.get(id) ?? 0;
    if (Date.now() - last >= SAVE_EVERY_MS) {
      persistJail(player, false);
    }
  });
}

async function releaseFromJail(player: Player): Promise<void> {
  const account = getAccount(player);
  if (!account || account.jailSeconds <= 0) {
    return;
  }

  try {
    await saveUserJailedSeconds(account.id, 0);
  } catch {
    return;
  }

  if (!isAuthenticated(player) || getAccount(player)?.id !== account.id) {
    return;
  }

  if (!isJailed(player)) {
    return;
  }

  patchAccount(player, { jailSeconds: 0 });
  const id = playerId(player);
  if (id !== null) {
    lastSavedAt.delete(id);
  }

  placeAtSpawn(player, FREEDOM);
  applyOrgVisuals(player);
  tell(player, Color.info, "Вы отсидели срок и вышли на свободу.");
}

function confineInmate(player: Player): void {
  try {
    const world = player.getVirtualWorld();
    if (world === PRISON_WORLD || world === PRISON_YARD_WORLD) {
      return;
    }
  } catch {
    return;
  }

  placeInJail(player);
}

function placeAtSpawn(player: Player, dest: SpawnPoint): void {
  try {
    try {
      if (player.isInAnyVehicle()) {
        player.removeFromVehicle();
      }
    } catch {
      // Пешком.
    }

    placeAt(player, dest);
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

function persistJail(player: Player, force: boolean): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (!force && account.jailSeconds <= 0) {
    return;
  }

  const id = playerId(player);
  if (id !== null) {
    lastSavedAt.set(id, Date.now());
  }

  void saveUserJailedSeconds(account.id, account.jailSeconds).catch(() => {
    // Сохранится при выходе или следующем тике.
  });
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Игрок уже вышел.
  }
}
