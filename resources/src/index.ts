import { omp } from "@omp-node/core";
import { SERVER_NAME, SERVER_TAG } from "./shared/brand";
import { databaseModule } from "./modules/database";
import { persistModule } from "./modules/persist";
import { authModule } from "./modules/auth";
import { spawnModule } from "./modules/spawn";
import { sessionModule } from "./modules/session";
import { chatModule } from "./modules/chat";
import { commandsModule } from "./modules/commands";
import { mappingModule } from "./modules/mapping";
import { hospitalModule } from "./modules/hospital";
import { cityHallModule } from "./modules/cityhall";
import { gpsModule } from "./modules/gps";
import { afkModule } from "./modules/afk";
import { minerModule } from "./modules/miner";
import { paydayModule } from "./modules/payday";
import { worldTimeModule } from "./modules/worldtime";
import { zonesModule } from "./modules/zones";
import { hudModule } from "./modules/hud";
import { adminModule } from "./modules/admin";
import { orgModule } from "./modules/org";
import type { GameModule } from "./modules/types";

const modules: GameModule[] = [
  databaseModule,
  persistModule,
  authModule,
  spawnModule,
  hospitalModule,
  cityHallModule,
  minerModule,
  gpsModule,
  afkModule,
  paydayModule,
  worldTimeModule,
  zonesModule,
  hudModule,
  sessionModule,
  chatModule,
  commandsModule,
  adminModule,
  orgModule,
  mappingModule,
];

omp.on("resourceStart", async () => {
  for (const mod of modules) {
    await mod.start();
    omp.log(`[${SERVER_TAG}] модуль запущен: ${mod.name}`);
  }

  omp.log(`[${SERVER_TAG}] ${SERVER_NAME} готов`);
});
