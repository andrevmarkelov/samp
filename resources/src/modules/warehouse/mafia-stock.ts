import { Checkpoint, omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  LCN_WORLD,
  MAFIA_INTERIOR,
  ORG_LCN_ID,
  ORG_RUSSIAN_MAFIA_ID,
  ORG_YAKUZA_ID,
  RUSSIAN_MAFIA_WORLD,
  YAKUZA_WORLD,
} from "../org";
import { getWarehouse } from "./repository";
import { notifyOrgStockStanding } from "./stock-interact";
import { clearOrgStockVisit } from "./stock-visit";

const POINT = {
  x: 1261.6088,
  y: -782.0201,
  z: 1084.0078,
} as const;

const LABEL_HEIGHT = 2.2;
const LABEL_DRAW_DISTANCE = 12;
const CHECKPOINT_RADIUS = 1.5;
const LEAVE_RADIUS = 2.8;
const SHOW_DISTANCE = 45;
const TICK_MS = 400;

type MafiaStock = {
  orgId: number;
  world: number;
  label: TextLabel;
};

const stocks: MafiaStock[] = [];
const checkpointShown = new Set<number>();

const MAFIA_STOCKS: readonly { orgId: number; world: number }[] = [
  { orgId: ORG_LCN_ID, world: LCN_WORLD },
  { orgId: ORG_YAKUZA_ID, world: YAKUZA_WORLD },
  { orgId: ORG_RUSSIAN_MAFIA_ID, world: RUSSIAN_MAFIA_WORLD },
];

function stockLabelText(orgId: number): string {
  const wh = getWarehouse(orgId);
  const ammo = wh?.ammo ?? 0;
  const metal = wh?.metal ?? 0;
  const drugs = wh?.drugs ?? 0;
  const status = wh && !wh.isLocked ? "Склад открыт" : "Склад закрыт";

  return (
    `Патроны: ${ammo}\n` +
    `Металл: ${metal}\n` +
    `Наркотики: ${drugs}\n\n` +
    status
  );
}

export function startMafiaWarehouseDisplays(): void {
  for (const def of MAFIA_STOCKS) {
    const label = new TextLabel(
      stockLabelText(def.orgId),
      Color.info,
      POINT.x,
      POINT.y,
      POINT.z + LABEL_HEIGHT,
      LABEL_DRAW_DISTANCE,
      def.world,
      false
    );
    stocks.push({ orgId: def.orgId, world: def.world, label });
  }

  setInterval(tickMafiaWarehouseCheckpoints, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      checkpointShown.delete(id);
    }
  });
}

export function refreshMafiaWarehouseLabels(): void {
  for (const stock of stocks) {
    try {
      stock.label.updateText(Color.info, stockLabelText(stock.orgId));
    } catch {
      // Лейбл уже уничтожен.
    }
  }
}

/** Точка склада мафии, если игрок в радиусе чекпоинта. */
export function findMafiaStockAtPlayer(player: Player): {
  orgId: number;
  x: number;
  y: number;
  z: number;
  world: number;
  interior: number;
} | null {
  try {
    if (player.getInterior() !== MAFIA_INTERIOR) {
      return null;
    }

    const world = player.getVirtualWorld();
    const def = MAFIA_STOCKS.find((item) => item.world === world);
    if (!def) {
      return null;
    }

    const pos = player.getPos();
    const dist = Math.hypot(pos.x - POINT.x, pos.y - POINT.y, pos.z - POINT.z);
    if (dist > LEAVE_RADIUS) {
      return null;
    }

    return {
      orgId: def.orgId,
      x: POINT.x,
      y: POINT.y,
      z: POINT.z,
      world: def.world,
      interior: MAFIA_INTERIOR,
    };
  } catch {
    return null;
  }
}

function tickMafiaWarehouseCheckpoints(): void {
  omp.players.forEach((player) => {
    updateCheckpointForPlayer(player);
  });
}

function updateCheckpointForPlayer(player: Player): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player)) {
    return;
  }

  let show = false;
  let onCheckpoint = false;
  try {
    if (player.getInterior() === MAFIA_INTERIOR) {
      const world = player.getVirtualWorld();
      if (MAFIA_STOCKS.some((item) => item.world === world)) {
        const pos = player.getPos();
        const dist = Math.hypot(pos.x - POINT.x, pos.y - POINT.y, pos.z - POINT.z);
        show = dist <= SHOW_DISTANCE;
        onCheckpoint = dist <= LEAVE_RADIUS;
      }
    }
  } catch {
    show = false;
    onCheckpoint = false;
  }

  if (show) {
    try {
      if (!checkpointShown.has(id)) {
        Checkpoint.set(player, POINT.x, POINT.y, POINT.z, CHECKPOINT_RADIUS);
        checkpointShown.add(id);
      }
    } catch {
      // Игрок уже вышел.
    }
    notifyOrgStockStanding(player, onCheckpoint);
    return;
  }

  // Не наш склад — не трогаем pending/visit.
  if (!checkpointShown.has(id)) {
    return;
  }

  checkpointShown.delete(id);
  clearOrgStockVisit(player);
  notifyOrgStockStanding(player, false);
  try {
    Checkpoint.disable(player);
  } catch {
    // Игрок уже вышел.
  }
}
