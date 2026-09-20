import { STREET_WORLD } from "../spawn/point";
import { defineGovOrg } from "./define";
import { POLICE_COLOR, POLICE_RANKS } from "./police-ranks";

export const ORG_POLICE_ID = 4;
export const POLICE_INTERIOR = 6;

export const POLICE = defineGovOrg(
  ORG_POLICE_ID,
  "Областная полиция",
  POLICE_COLOR,
  {
    x: 219.4583,
    y: 69.0118,
    z: 1005.0391,
    angle: 1.3001,
    interior: POLICE_INTERIOR,
    world: STREET_WORLD,
  },
  POLICE_RANKS
);
