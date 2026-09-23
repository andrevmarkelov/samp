import { WEAPON_SLOTS } from "./codes";

export type WeaponSlotState = {
  id: number;
  ammo: number;
};

export type PlayerAcState = {
  spawned: boolean;
  spectating: boolean;
  frozen: boolean;
  dead: boolean;
  x: number;
  y: number;
  z: number;
  interior: number;
  world: number;
  health: number;
  armour: number;
  money: number;
  weapons: WeaponSlotState[];
  vehicleId: number;
  seat: number;
  specialAction: number;
  speed: number;
  lastShotAt: number;
  lastUpdateAt: number;
  posTrustedUntil: number;
  moneyTrustedUntil: number;
  healthTrustedUntil: number;
  armourTrustedUntil: number;
  weaponTrustedUntil: number;
  vehicleTrustedUntil: number;
  warnAirFoot: number;
  warnAirVeh: number;
  warnFly: number;
  warnSpeedFoot: number;
  warnSpeedVeh: number;
  warnPing: number;
  warnRapid: number;
  warnFlood: Map<string, number[]>;
  strikes: Map<number, number>;
  strikeAt: Map<number, number>;
  disabledCodes: Set<number>;
  ip: string;
  name: string;
  joinedAt: number;
  lastReconnectAt: number;
  dialogId: number;
};

export type VehicleAcState = {
  x: number;
  y: number;
  z: number;
  health: number;
  driverId: number;
  speed: number;
};

const players = new Map<number, PlayerAcState>();
const vehicles = new Map<number, VehicleAcState>();
const ipConnects = new Map<string, number>();
/** Последний дисконнект: ip -> { name, at } */
const recentDisconnects = new Map<string, { name: string; at: number }>();

function emptyWeapons(): WeaponSlotState[] {
  return Array.from({ length: WEAPON_SLOTS }, () => ({ id: 0, ammo: 0 }));
}

export function createPlayerState(ip: string, name = ""): PlayerAcState {
  const now = Date.now();
  return {
    spawned: false,
    spectating: false,
    frozen: false,
    dead: false,
    x: 0,
    y: 0,
    z: 0,
    interior: 0,
    world: 0,
    health: 100,
    armour: 0,
    money: 0,
    weapons: emptyWeapons(),
    vehicleId: 0,
    seat: -1,
    specialAction: 0,
    speed: 0,
    lastShotAt: 0,
    lastUpdateAt: now,
    posTrustedUntil: now + 3000,
    moneyTrustedUntil: now + 3000,
    healthTrustedUntil: now + 3000,
    armourTrustedUntil: now + 3000,
    weaponTrustedUntil: now + 3000,
    vehicleTrustedUntil: now + 3000,
    warnAirFoot: 0,
    warnAirVeh: 0,
    warnFly: 0,
    warnSpeedFoot: 0,
    warnSpeedVeh: 0,
    warnPing: 0,
    warnRapid: 0,
    warnFlood: new Map(),
    strikes: new Map(),
    strikeAt: new Map(),
    disabledCodes: new Set(),
    ip,
    name,
    joinedAt: now,
    lastReconnectAt: 0,
    dialogId: -1,
  };
}

export function getPlayerState(id: number): PlayerAcState | null {
  return players.get(id) ?? null;
}

export function setPlayerState(id: number, state: PlayerAcState): void {
  players.set(id, state);
}

export function deletePlayerState(id: number): void {
  players.delete(id);
}

export function getVehicleState(id: number): VehicleAcState | null {
  return vehicles.get(id) ?? null;
}

export function ensureVehicleState(id: number): VehicleAcState {
  let state = vehicles.get(id);
  if (!state) {
    state = { x: 0, y: 0, z: 0, health: 1000, driverId: -1, speed: 0 };
    vehicles.set(id, state);
  }
  return state;
}

export function deleteVehicleState(id: number): void {
  vehicles.delete(id);
}

export function bumpIpConnect(ip: string): number {
  if (!ip) return 1;
  const next = (ipConnects.get(ip) ?? 0) + 1;
  ipConnects.set(ip, next);
  return next;
}

export function dropIpConnect(ip: string): void {
  if (!ip) return;
  const cur = ipConnects.get(ip) ?? 0;
  if (cur <= 1) ipConnects.delete(ip);
  else ipConnects.set(ip, cur - 1);
}

export function markDisconnect(ip: string, name: string): void {
  if (!ip) return;
  recentDisconnects.set(ip, { name: name.trim().toLowerCase(), at: Date.now() });
}

/** Возвращает gap мс только если с того же IP зашел тот же ник слишком быстро. */
export function takeReconnectGap(ip: string, name: string): number | null {
  if (!ip) return null;
  const prev = recentDisconnects.get(ip);
  if (!prev) return null;
  recentDisconnects.delete(ip);
  const nick = name.trim().toLowerCase();
  if (!nick || prev.name !== nick) return null;
  return Date.now() - prev.at;
}

export function forEachPlayerState(
  fn: (id: number, state: PlayerAcState) => void
): void {
  for (const [id, state] of players) {
    fn(id, state);
  }
}
