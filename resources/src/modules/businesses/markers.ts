import { Pickup, TextLabel } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { STREET_WORLD } from "../spawn/point";
import type { BusinessRecord } from "./repository";
import { businessHasInterior, getBusiness, listBusinesses } from "./repository";
import { isGasStationType, isStreetFoodType } from "./types";

const STREET_PICKUP_MODEL = 19132;
const GAS_PICKUP_MODEL = 1650;
const STREET_FOOD_PICKUP_MODEL = 2814;
const PICKUP_TYPE = 1;
const LABEL_HEIGHT = 0.95;
const LABEL_DRAW_DISTANCE = 20;

type StreetMarker = {
  businessId: number;
  label: TextLabel;
  pickup: Pickup;
};

const markers = new Map<number, StreetMarker>();

const C_NAME = "{FFFF00}";
const C_LABEL = "{FFFFFF}";
const C_OWNER = "{33CCFF}";
const C_FREE = "{33FF00}";
const C_PRICE = "{FFFFFF}";

export function businessLabelText(business: BusinessRecord): string {
  const lines = [
    `${C_NAME}${business.name} (#${business.id})`,
    `${C_LABEL}Стоимость: ${C_PRICE}${formatMoney(business.price)}`,
  ];

  if (business.ownerName !== null) {
    lines.push(`${C_LABEL}Владелец: ${C_OWNER}${business.ownerName}`);
  } else {
    lines.push(`${C_FREE}Купить бизнес: /buybiz`);
  }

  if (businessHasInterior(business)) {
    lines.push(
      business.entranceFee > 0
        ? `${C_LABEL}Вход: ${C_PRICE}${formatMoney(business.entranceFee)}`
        : `${C_FREE}Вход бесплатный`
    );
  }

  if (isGasStationType(business.typeId)) {
    lines.push(`${C_FREE}Сигнал (H) — заправка`);
  }

  return lines.join("\n");
}

export function startBusinessMarkers(): void {
  for (const business of listBusinesses()) {
    createStreetMarker(business);
  }
}

export function refreshBusinessLabel(businessId: number): void {
  const business = getBusiness(businessId);
  const marker = markers.get(businessId);
  if (!business || !marker) {
    return;
  }

  try {
    marker.label.updateText(Color.info, businessLabelText(business));
  } catch {
    // Лейбл уже уничтожен.
  }
}

function streetPickupModel(typeId: number): number {
  if (isGasStationType(typeId)) {
    return GAS_PICKUP_MODEL;
  }
  if (isStreetFoodType(typeId)) {
    return STREET_FOOD_PICKUP_MODEL;
  }
  return STREET_PICKUP_MODEL;
}

function createStreetMarker(business: BusinessRecord): void {
  const label = new TextLabel(
    businessLabelText(business),
    Color.info,
    business.entranceX,
    business.entranceY,
    business.entranceZ + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    STREET_WORLD,
    false
  );

  const pickup = new Pickup(
    streetPickupModel(business.typeId),
    PICKUP_TYPE,
    business.entranceX,
    business.entranceY,
    business.entranceZ,
    STREET_WORLD
  );

  markers.set(business.id, {
    businessId: business.id,
    label,
    pickup,
  });
}
