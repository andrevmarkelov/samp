import { ORG_ARMY_ID } from "../org/army";

/** Ванильный интерьер завода (ID 2). */
export const ARMY_FACTORY_INTERIOR = 2;

/**
 * VW завода = id Армии. Армия и FBI входят в один инстанс.
 * Улица остаётся STREET_WORLD (0).
 */
export const ARMY_FACTORY_WORLD = ORG_ARMY_ID;

/** Пикап раздевалки (устройство / завершение). */
export const HIRE_POINT = {
  x: 2567.759,
  y: -1281.4629,
  z: 1044.125,
} as const;

/** Жёлтые пикапы — заготовки гильз. */
export const BLANK_POINTS: readonly { x: number; y: number; z: number }[] = [
  { x: 2559.323, y: -1287.3453, z: 1044.125 },
  { x: 2551.165, y: -1287.2174, z: 1044.125 },
  { x: 2543.2117, y: -1287.355, z: 1044.125 },
  { x: 2543.0767, y: -1300.0945, z: 1044.125 },
  { x: 2550.8789, y: -1300.0017, z: 1044.125 },
  { x: 2558.8235, y: -1299.9015, z: 1044.125 },
];

/** Станы сборки: пикап + объект на столе + угол игрока. */
export const BENCH_POINTS: readonly {
  pickup: { x: number; y: number; z: number };
  object: { x: number; y: number; z: number; rz: number };
  facing: number;
}[] = [
  {
    pickup: { x: 2558.5774, y: -1291.0057, z: 1044.125 },
    object: { x: 2558.41, y: -1292.01, z: 1044.08, rz: 179.09 },
    facing: 180,
  },
  {
    pickup: { x: 2556.0806, y: -1291.0057, z: 1044.125 },
    object: { x: 2556.01, y: -1292.0, z: 1044.12, rz: -179.49 },
    facing: 180,
  },
  {
    pickup: { x: 2553.792, y: -1291.0044, z: 1044.125 },
    object: { x: 2553.67, y: -1292.0, z: 1044.07, rz: 177.99 },
    facing: 180,
  },
  {
    pickup: { x: 2544.2935, y: -1291.0057, z: 1044.125 },
    object: { x: 2544.31, y: -1291.96, z: 1044.06, rz: 179.19 },
    facing: 180,
  },
  {
    pickup: { x: 2541.9478, y: -1291.0051, z: 1044.125 },
    object: { x: 2541.96, y: -1291.91, z: 1044.14, rz: 176.69 },
    facing: 180,
  },
  {
    pickup: { x: 2542.0269, y: -1295.8499, z: 1044.125 },
    object: { x: 2542.17, y: -1294.95, z: 1044.11, rz: 0 },
    facing: 0,
  },
  {
    pickup: { x: 2544.5146, y: -1295.8497, z: 1044.125 },
    object: { x: 2544.47, y: -1294.89, z: 1044.08, rz: 0 },
    facing: 0,
  },
  {
    pickup: { x: 2553.8198, y: -1295.8513, z: 1044.125 },
    object: { x: 2553.85, y: -1294.92, z: 1044.07, rz: 0 },
    facing: 0,
  },
  {
    pickup: { x: 2556.1992, y: -1295.8508, z: 1044.125 },
    object: { x: 2556.22, y: -1294.92, z: 1044.06, rz: 0 },
    facing: 0,
  },
  {
    pickup: { x: 2558.5471, y: -1295.8512, z: 1044.125 },
    object: { x: 2558.48, y: -1294.87, z: 1044.03, rz: 0 },
    facing: 0,
  },
];

/** Сдача готовых патронов. */
export const STOCK_POINTS: readonly { x: number; y: number; z: number }[] = [
  { x: 2564.3374, y: -1292.8196, z: 1044.125 },
];
