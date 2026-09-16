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

export const STREET_WORLD = 0;

/** Отдельный VW больницы: игроки и пикапы внутри не пересекаются с улицей. */
export const HOSPITAL_WORLD = 1;

/** Обычный спавн, пока игрок не в организации. */
export const DEFAULT_SPAWN: SpawnPoint = {
  x: 1760.2538,
  y: -1898.8334,
  z: 13.5629,
  angle: 269.124,
  interior: 0,
  world: STREET_WORLD,
};

export const HOSPITAL_SPAWNS: readonly SpawnPoint[] = [
  {
    x: 1576.0293,
    y: 1806.7817,
    z: -20.7665,
    angle: 179.2983,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1585.931,
    y: 1807.0443,
    z: -20.7665,
    angle: 179.9484,
    interior: 0,
    world: HOSPITAL_WORLD,
  },
  {
    x: 1596.0117,
    y: 1807.0649,
    z: -20.7665,
    angle: 179.0318,
    interior: 0,
    world: HOSPITAL_WORLD,
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
