import { STREET_WORLD } from "../spawn/point";
import { defineGovOrg } from "./define";
import { ORG_FBI_ID } from "./fbi";
import { ORG_POLICE_ID } from "./police";
import { POLICE_COLOR, POLICE_RANKS } from "./police-ranks";
import type { OrgGateDef } from "./types";

export const ORG_LSPD_ID = 5;
export const LSPD_INTERIOR = 10;

export const LSPD = defineGovOrg(
  ORG_LSPD_ID,
  "LSPD",
  POLICE_COLOR,
  {
    x: 274.0818,
    y: 125.2646,
    z: 1004.6172,
    angle: 89.6843,
    interior: LSPD_INTERIOR,
    world: STREET_WORLD,
  },
  POLICE_RANKS
);

export const LAW_ORG_IDS = [ORG_LSPD_ID, ORG_POLICE_ID, ORG_FBI_ID] as const;
const LAW_GATE_DENY = "Открыть могут сотрудники LSPD, областной полиции и FBI.";

export const LSPD_GATES: OrgGateDef[] = [
  {
    orgId: ORG_LSPD_ID,
    orgIds: LAW_ORG_IDS,
    model: 968,
    x: 1544.69019,
    y: -1630.83936,
    zClosed: 13.0765,
    zOpen: 13.0765,
    rx: 0,
    ry: 90,
    ryOpen: 0,
    rz: 90,
    radius: 14,
    denyMessage: LAW_GATE_DENY,
  },
  {
    orgId: ORG_LSPD_ID,
    orgIds: LAW_ORG_IDS,
    model: 19912,
    x: 1596.14673,
    y: -1637.87109,
    zClosed: 15.0741,
    zOpen: 9.5761,
    rx: 0,
    ry: 0,
    rz: 0,
    radius: 14,
    denyMessage: LAW_GATE_DENY,
  },
];
