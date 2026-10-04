import { TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import {
  getHouse,
  hasHouseStore,
  listHouses,
  type HouseRecord,
} from "./repository";
import { houseVirtualWorld } from "./world";

const LABEL_HEIGHT = 1.2;
const LABEL_DRAW_DISTANCE = 12;
/** Радиус для /use у установленного шкафа. */
export const HOUSE_STORE_USE_RADIUS = 2;

type HouseStoreLabel = {
  houseId: number;
  label: TextLabel;
};

const labels = new Map<number, HouseStoreLabel>();

function storeLabelText(house: HouseRecord): string {
  return (
    `Шкаф\n` +
    `Патроны: ${house.storeAmmo}\n` +
    `Металл: ${house.storeMetal}\n` +
    `Наркотики: ${house.storeDrugs}\n` +
    `Деньги: ${formatMoney(house.storeMoney)}`
  );
}

export function startHouseStoreDisplays(): void {
  for (const house of listHouses()) {
    if (hasHouseStore(house)) {
      ensureHouseStoreLabel(house.id);
    }
  }
}

export function ensureHouseStoreLabel(houseId: number): void {
  const house = getHouse(houseId);
  if (!house || !hasHouseStore(house)) {
    removeHouseStoreLabel(houseId);
    return;
  }

  const existing = labels.get(houseId);
  if (existing) {
    try {
      existing.label.destroy();
    } catch {
      // Уже уничтожен.
    }
    labels.delete(houseId);
  }

  const world = houseVirtualWorld(houseId);
  const label = new TextLabel(
    storeLabelText(house),
    Color.info,
    house.storeX!,
    house.storeY!,
    house.storeZ! + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    world,
    false
  );
  labels.set(houseId, { houseId, label });
}

export function refreshHouseStoreLabel(houseId: number): void {
  const house = getHouse(houseId);
  const entry = labels.get(houseId);
  if (!house || !hasHouseStore(house) || !entry) {
    if (!house || !hasHouseStore(house)) {
      removeHouseStoreLabel(houseId);
    }
    return;
  }

  try {
    entry.label.updateText(Color.info, storeLabelText(house));
  } catch {
    ensureHouseStoreLabel(houseId);
  }
}

export function removeHouseStoreLabel(houseId: number): void {
  const entry = labels.get(houseId);
  if (!entry) {
    return;
  }

  try {
    entry.label.destroy();
  } catch {
    // Уже уничтожен.
  }

  labels.delete(houseId);
}

export function isPlayerAtHouseStore(player: Player, house: HouseRecord): boolean {
  if (!hasHouseStore(house)) {
    return false;
  }

  try {
    if (player.getVirtualWorld() !== houseVirtualWorld(house.id)) {
      return false;
    }

    if (player.getInterior() !== house.interiorId) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(
        pos.x - house.storeX!,
        pos.y - house.storeY!,
        pos.z - house.storeZ!
      ) <= HOUSE_STORE_USE_RADIUS
    );
  } catch {
    return false;
  }
}
