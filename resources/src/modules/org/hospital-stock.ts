import { Pickup, TextLabel } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { HOSPITAL_WORLD } from "../spawn/point";
import { getWarehouse } from "../warehouse";
import { ORG_HOSPITAL_ID } from "./hospital";

const PICKUP_MODEL = 11738;
const PICKUP_TYPE = 1;
const LABEL_HEIGHT = 1.85;
const LABEL_DRAW_DISTANCE = 14;

/** Склад медикаментов в служебном блоке больницы. */
export const HOSPITAL_MEDS_STOCK_POINT = {
  x: 1156.484,
  y: -1342.847,
  z: 3001.0845,
  world: HOSPITAL_WORLD,
} as const;

let medsStockLabel: TextLabel | null = null;

function medsStockLabelText(): string {
  const meds = getWarehouse(ORG_HOSPITAL_ID)?.meds ?? 0;
  return `Склад медикаментов\nМедикаменты: ${meds}`;
}

export function refreshHospitalMedsStockLabel(): void {
  if (!medsStockLabel) {
    return;
  }

  try {
    medsStockLabel.updateText(Color.info, medsStockLabelText());
  } catch {
    // Лейбл уже уничтожен.
  }
}

/** Склад медикаментов в служебном блоке. */
export function bindHospitalStock(): void {
  new Pickup(
    PICKUP_MODEL,
    PICKUP_TYPE,
    HOSPITAL_MEDS_STOCK_POINT.x,
    HOSPITAL_MEDS_STOCK_POINT.y,
    HOSPITAL_MEDS_STOCK_POINT.z,
    HOSPITAL_MEDS_STOCK_POINT.world
  );
  medsStockLabel = new TextLabel(
    medsStockLabelText(),
    Color.info,
    HOSPITAL_MEDS_STOCK_POINT.x,
    HOSPITAL_MEDS_STOCK_POINT.y,
    HOSPITAL_MEDS_STOCK_POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    HOSPITAL_MEDS_STOCK_POINT.world,
    false
  );
}
