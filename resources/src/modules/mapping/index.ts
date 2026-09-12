import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { omp } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import type { GameModule } from "../types";
import { loadPawnMap } from "./pawn-map";

const MAPS_DIR = join(process.cwd(), "maps");

export const mappingModule: GameModule = {
  name: "mapping",
  start() {
    let files: string[] = [];

    try {
      files = readdirSync(MAPS_DIR).filter((name) => name.toLowerCase().endsWith(".txt"));
    } catch {
      omp.log(`[${SERVER_TAG}] папка maps не найдена`);
      return;
    }

    for (const file of files) {
      try {
        const source = readFileSync(join(MAPS_DIR, file), "utf8");
        const count = loadPawnMap(source);
        omp.log(`[${SERVER_TAG}] карта ${file}: объектов ${count}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] карта ${file} не загрузилась: ${message}`);
      }
    }
  },
};
