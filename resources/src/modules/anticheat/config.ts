import { AcCode, AC_CODE_COUNT, NopCode, NOP_CODE_COUNT } from "./codes";

export type AcConfig = {
  enabled: boolean;
  debug: boolean;
  maxPing: number;
  maxPingWarnings: number;
  maxConnectsPerIp: number;
  kickOnDetect: boolean;
  /** Сколько срабатываний одного кода до кика (soft). */
  softStrikeMax: number;
  /** За сколько мс сбрасывается soft-страйк без повторов. */
  softStrikeDecayMs: number;
  reconnectMinMs: number;
  airBreakWarnings: number;
  airBreakVehWarnings: number;
  flyWarnings: number;
  speedFootMax: number;
  speedVehMax: number;
  speedWarnings: number;
  teleportFootDist: number;
  teleportVehDist: number;
  moneyGraceMs: number;
  posGraceMs: number;
  healthGraceMs: number;
  weaponGraceMs: number;
  floodWindowMs: number;
  floodMaxEvents: number;
  rapidFireMinMs: number;
  codes: boolean[];
  nops: boolean[];
};

function allTrue(n: number, except: number[] = []): boolean[] {
  const arr = Array.from({ length: n }, () => true);
  for (const i of except) {
    if (i >= 0 && i < n) arr[i] = false;
  }
  return arr;
}

/** Коды без реализации или с высоким FP - выключены. */
const DISABLED_CODES = [
  AcCode.Parkour,
  AcCode.UnFreeze,
  AcCode.FakeNpc,
  AcCode.LagCompSpoof,
  AcCode.ProAim,
  AcCode.RconBrute,
  AcCode.AttachCrasher,
  AcCode.GodModeFoot,
  AcCode.GodModeVeh,
  AcCode.FullAiming,
  AcCode.CarShot,
  AcCode.QuickTurn,
  AcCode.CarJack,
  AcCode.AfkGhost,
  AcCode.InvalidVersion,
  AcCode.TuningCrasher,
  AcCode.SeatCrasher,
  AcCode.DialogCrasher,
  AcCode.ConnectFlood,
  AcCode.SeatFlood,
  AcCode.Invisible,
  AcCode.DialogHack,
  AcCode.TeleportVehToPlayer,
  AcCode.TeleportPickup,
  AcCode.Tuning,
  AcCode.FakeKill,
  AcCode.Nop,
  AcCode.AmmoInfinite,
  AcCode.RapidFire,
  AcCode.CjRun,
];

/** Эти коды кикают сразу, без soft-страйков. */
export const INSTANT_KICK_CODES = new Set<AcCode>([
  AcCode.WeaponCrasher,
  AcCode.FakeSpawn,
  AcCode.Dos,
  AcCode.Sandbox,
]);

export const defaultConfig: AcConfig = {
  enabled: true,
  debug: false,
  maxPing: 550,
  maxPingWarnings: 10,
  maxConnectsPerIp: 4,
  kickOnDetect: true,
  softStrikeMax: 1,
  softStrikeDecayMs: 90_000,
  reconnectMinMs: 8_000,
  airBreakWarnings: 5,
  airBreakVehWarnings: 4,
  flyWarnings: 3,
  speedFootMax: 300,
  speedVehMax: 380,
  speedWarnings: 4,
  teleportFootDist: 50,
  teleportVehDist: 60,
  moneyGraceMs: 2000,
  posGraceMs: 3000,
  healthGraceMs: 3000,
  weaponGraceMs: 2500,
  floodWindowMs: 1000,
  floodMaxEvents: 12,
  rapidFireMinMs: 45,
  codes: allTrue(AC_CODE_COUNT, DISABLED_CODES),
  nops: allTrue(NOP_CODE_COUNT, [
    NopCode.GiveWeapon,
    NopCode.SetAmmo,
    NopCode.SetInterior,
    NopCode.SetHealth,
    NopCode.SetVehicleHealth,
    NopCode.SetArmour,
    NopCode.SetSpecialAction,
    NopCode.PutInVehicle,
    NopCode.ToggleSpectating,
    NopCode.Spawn,
    NopCode.SetPos,
    NopCode.RemoveFromVehicle,
  ]),
};

let config: AcConfig = {
  ...defaultConfig,
  codes: [...defaultConfig.codes],
  nops: [...defaultConfig.nops],
};

export function getConfig(): AcConfig {
  return config;
}

export function isCodeEnabled(code: AcCode): boolean {
  return config.enabled && Boolean(config.codes[code]);
}

export function isNopEnabled(code: NopCode): boolean {
  return config.enabled && Boolean(config.nops[code]);
}

export function setCodeEnabled(code: AcCode, enabled: boolean): boolean {
  if (code < 0 || code >= AC_CODE_COUNT) return false;
  config.codes[code] = enabled;
  return true;
}

export function setNopEnabled(code: NopCode, enabled: boolean): boolean {
  if (code < 0 || code >= NOP_CODE_COUNT) return false;
  config.nops[code] = enabled;
  return true;
}
