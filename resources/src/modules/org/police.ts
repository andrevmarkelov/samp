import { defineGovOrg } from "./define";
import { POLICE_COLOR, POLICE_RANKS } from "./police-ranks";

export const ORG_POLICE_ID = 4;
/** Кастомный интерьер участка. Объекты `maps/police.txt` тоже в interior 6. */
export const POLICE_INTERIOR = 6;
/** Свой мир, чтобы офис не смешивался с улицей. Карта: MapVirtualWorld(21). */
export const POLICE_WORLD = 21;

export const POLICE = defineGovOrg(
  ORG_POLICE_ID,
  "Областная полиция",
  POLICE_COLOR,
  {
    x: 619.4138,
    y: -579.6217,
    z: 1929.615,
    angle: 359.1795,
    interior: POLICE_INTERIOR,
    world: POLICE_WORLD,
  },
  POLICE_RANKS
);
