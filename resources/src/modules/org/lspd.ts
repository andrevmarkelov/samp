import { defineGovOrg, streetSpawn } from "./define";
import { POLICE_COLOR, POLICE_RANKS } from "./police-ranks";

export const ORG_LSPD_ID = 5;

export const LSPD = defineGovOrg(
  ORG_LSPD_ID,
  "LSPD",
  POLICE_COLOR,
  streetSpawn(1529.5903, -1669.8129, 6.2188, 270.2384),
  POLICE_RANKS
);
