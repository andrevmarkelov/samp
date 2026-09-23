/** Коды детектов античита (серверные проверки). */
export enum AcCode {
  AirBreakFoot = 0,
  AirBreakVeh = 1,
  TeleportFoot = 2,
  TeleportVeh = 3,
  TeleportVehEnter = 4,
  TeleportVehToPlayer = 5,
  TeleportPickup = 6,
  FlyHackFoot = 7,
  FlyHackVeh = 8,
  SpeedHackFoot = 9,
  SpeedHackVeh = 10,
  HealthVeh = 11,
  HealthFoot = 12,
  Armour = 13,
  Money = 14,
  Weapon = 15,
  AmmoAdd = 16,
  AmmoInfinite = 17,
  SpecialAction = 18,
  GodModeFoot = 19,
  GodModeVeh = 20,
  Invisible = 21,
  LagCompSpoof = 22,
  Tuning = 23,
  Parkour = 24,
  QuickTurn = 25,
  RapidFire = 26,
  FakeSpawn = 27,
  FakeKill = 28,
  ProAim = 29,
  CjRun = 30,
  CarShot = 31,
  CarJack = 32,
  UnFreeze = 33,
  AfkGhost = 34,
  FullAiming = 35,
  FakeNpc = 36,
  Reconnect = 37,
  HighPing = 38,
  DialogHack = 39,
  Sandbox = 40,
  InvalidVersion = 41,
  RconBrute = 42,
  TuningCrasher = 43,
  SeatCrasher = 44,
  DialogCrasher = 45,
  AttachCrasher = 46,
  WeaponCrasher = 47,
  ConnectFlood = 48,
  CallbackFlood = 49,
  SeatFlood = 50,
  Dos = 51,
  Nop = 52,
}

export const AC_CODE_COUNT = 53;

export enum NopCode {
  GiveWeapon = 0,
  SetAmmo = 1,
  SetInterior = 2,
  SetHealth = 3,
  SetVehicleHealth = 4,
  SetArmour = 5,
  SetSpecialAction = 6,
  PutInVehicle = 7,
  ToggleSpectating = 8,
  Spawn = 9,
  SetPos = 10,
  RemoveFromVehicle = 11,
}

export const NOP_CODE_COUNT = 12;

export const WEAPON_SLOTS = 13;

export const PLAYER_STATE = {
  none: 0,
  onfoot: 1,
  driver: 2,
  passenger: 3,
  exitVehicle: 4,
  enterVehicle: 5,
  wasted: 6,
  spawned: 7,
  spectating: 8,
} as const;

export const SPECIAL_ACTION = {
  none: 0,
  jetpack: 2,
} as const;

/** Слот оружия по ID (GTA SA). */
export function weaponSlot(weaponId: number): number {
  if (weaponId <= 0) return -1;
  if (weaponId === 1) return 0;
  if (weaponId >= 2 && weaponId <= 9) return 1;
  if (weaponId >= 22 && weaponId <= 24) return 2;
  if (weaponId >= 25 && weaponId <= 27) return 3;
  if (weaponId === 28 || weaponId === 29 || weaponId === 32) return 4;
  if (weaponId === 30 || weaponId === 31) return 5;
  if (weaponId === 33 || weaponId === 34) return 6;
  if (weaponId >= 35 && weaponId <= 38) return 7;
  if (weaponId === 16 || weaponId === 18 || weaponId === 39) return 8;
  if (weaponId >= 41 && weaponId <= 43) return 9;
  if (weaponId >= 10 && weaponId <= 15) return 10;
  if (weaponId === 44 || weaponId === 45 || weaponId === 46) return 11;
  if (weaponId === 40) return 12;
  return -1;
}

export function isValidWeaponId(weaponId: number): boolean {
  return weaponSlot(weaponId) >= 0;
}
