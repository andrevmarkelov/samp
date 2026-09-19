import { defineGovOrg, streetSpawn } from "./define";
import { POLICE_COLOR, POLICE_RANKS } from "./police-ranks";

export const ORG_POLICE_ID = 4;

export const POLICE = defineGovOrg(
  ORG_POLICE_ID,
  "Oblastnaya policiya",
  POLICE_COLOR,
  streetSpawn(614.4716, -590.924, 17.233, 268.0451),
  POLICE_RANKS
);
