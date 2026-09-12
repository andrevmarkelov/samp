import type { Player } from "@omp-node/core";

export type SpawnPoint = {
  x: number;
  y: number;
  z: number;
  angle: number;
  interior: number;
  world: number;
};

export const NO_TEAM = 255;

/** Скин для class-селектора, если у игрока ещё нет аккаунта. */
export const DEFAULT_SPAWN_SKIN = 26;

/** Обычный спавн, пока игрок не в организации. */
export const DEFAULT_SPAWN: SpawnPoint = {
  x: 2495.3547,
  y: -1688.2319,
  z: 13.6774,
  angle: 351.1646,
  interior: 0,
  world: 0,
};

export const HOSPITAL_SPAWNS: readonly SpawnPoint[] = [
  {
    x: 2034.0479,
    y: -1404.7686,
    z: 17.2143,
    angle: 180,
    interior: 0,
    world: 0,
  },
  {
    x: 2027.5,
    y: -1412.8,
    z: 16.9922,
    angle: 0,
    interior: 0,
    world: 0,
  },
  {
    x: 2041.2,
    y: -1412.8,
    z: 16.9922,
    angle: 0,
    interior: 0,
    world: 0,
  },
  {
    x: 2034.1641,
    y: -1426.5117,
    z: 16.9922,
    angle: 0,
    interior: 0,
    world: 0,
  },
];

export function pickHospitalSpawn(): SpawnPoint {
  const first = HOSPITAL_SPAWNS[0];
  if (!first) {
    return DEFAULT_SPAWN;
  }

  const index = Math.floor(Math.random() * HOSPITAL_SPAWNS.length);
  return HOSPITAL_SPAWNS[index] ?? first;
}

export function writeSpawnInfo(player: Player, skin: number, point: SpawnPoint): void {
  player.setSpawnInfo(
    NO_TEAM,
    skin,
    point.x,
    point.y,
    point.z,
    point.angle,
    0,
    0,
    0,
    0,
    0,
    0
  );
}

export function placeAt(player: Player, point: SpawnPoint): void {
  player.setInterior(point.interior);
  player.setVirtualWorld(point.world);
  player.setPos(point.x, point.y, point.z);
  player.setFacingAngle(point.angle);
  player.setCameraBehind();
}
