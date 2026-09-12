import { PlayerObject, omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import type { MapBuildingRemove, MapObjectDef } from "./pawn-map";

const DRAW_DISTANCE = 300;
const STREAM_IN = 280;
const STREAM_OUT = 340;
const MAX_VISIBLE = 900;
const TICK_MS = 400;

const spawned = new Map<number, Map<number, PlayerObject>>();

let defs: MapObjectDef[] = [];
let removals: MapBuildingRemove[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
const removalsApplied = new Set<number>();

export function startObjectStream(
  objects: MapObjectDef[],
  buildingRemovals: MapBuildingRemove[]
): void {
  defs = objects;
  removals = buildingRemovals;
  if (timer) {
    return;
  }

  timer = setInterval(tickStream, TICK_MS);

  omp.on("playerConnect", (player) => {
    applyBuildingRemovals(player);
    setTimeout(() => applyBuildingRemovals(player), 50);
    setTimeout(() => applyBuildingRemovals(player), 400);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      removalsApplied.delete(id);
    }
    clearPlayerObjects(player);
  });
}

function applyBuildingRemovals(player: Player): void {
  if (!isPlayerActive(player) || removals.length === 0) {
    return;
  }

  const id = playerId(player);
  if (id === null || removalsApplied.has(id)) {
    return;
  }

  try {
    for (const item of removals) {
      player.removeBuilding(item.model, item.x, item.y, item.z, item.radius);
    }
    removalsApplied.add(id);
  } catch {
    // Слот ещё не готов — повторит второй таймер.
  }
}

function tickStream(): void {
  omp.players.forEach((player) => {
    refreshStreamForPlayer(player);
  });
}

export function refreshStreamForPlayer(player: Player): void {
  if (!isPlayerActive(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  try {
    const pos = player.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
  } catch {
    return;
  }

  let bag = spawned.get(id);
  if (!bag) {
    bag = new Map();
    spawned.set(id, bag);
  }

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!def) {
      continue;
    }

    const dist = Math.hypot(x - def.x, y - def.y, z - def.z);
    const current = bag.get(i);

    if (dist <= STREAM_IN) {
      if (!current && bag.size < MAX_VISIBLE) {
        const created = spawnForPlayer(player, def);
        if (created) {
          bag.set(i, created);
        }
      }
      continue;
    }

    if (dist > STREAM_OUT && current) {
      try {
        current.destroy();
      } catch {
        // Уже уничтожен.
      }
      bag.delete(i);
    }
  }
}

function spawnForPlayer(player: Player, def: MapObjectDef): PlayerObject | null {
  try {
    const object = new PlayerObject(
      player,
      def.model,
      def.x,
      def.y,
      def.z,
      def.rx,
      def.ry,
      def.rz,
      DRAW_DISTANCE
    );

    for (const material of def.materials) {
      try {
        object.setMaterial(
          material.index,
          material.model,
          material.txd,
          material.texture,
          material.color
        );
      } catch {
        // Слот материала не принял движок.
      }
    }

    for (const text of def.texts) {
      try {
        object.setMaterialText(
          text.text,
          text.index,
          text.size,
          text.font,
          text.fontSize,
          text.bold,
          text.fontColor,
          text.backColor,
          text.alignment
        );
      } catch {
        // Текст на объекте не принял движок.
      }
    }

    return object;
  } catch {
    return null;
  }
}

function clearPlayerObjects(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const bag = spawned.get(id);
  if (!bag) {
    return;
  }

  for (const object of bag.values()) {
    try {
      object.destroy();
    } catch {
      // Уже уничтожен.
    }
  }

  spawned.delete(id);
}
