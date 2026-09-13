import { Class, omp, Vehicle, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { playerId } from "../../shared/player";
import { holdAtAuth } from "../auth/flow";
import {
  HOSPITAL_HEALTH,
  applyHealth,
  applyScore,
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { queueSave } from "../persist";
import { applyOrgVisuals, resolveOrgSpawn, resolvePlayerSkin } from "../org";
import { saveUserHospitalized } from "../auth/repository";
import { refreshStreamForPlayer } from "../mapping/stream";
import type { GameModule } from "../types";
import {
  DEFAULT_SPAWN,
  DEFAULT_SPAWN_SKIN,
  NO_TEAM,
  pickHospitalSpawn,
  placeAt,
  writeSpawnInfo,
  type SpawnPoint,
} from "./point";

const pendingHospital = new Map<number, SpawnPoint>();
const seenWorldSpawn = new Set<number>();

export const spawnModule: GameModule = {
  name: "spawn",
  start() {
    new Class(
      NO_TEAM,
      DEFAULT_SPAWN_SKIN,
      DEFAULT_SPAWN.x,
      DEFAULT_SPAWN.y,
      DEFAULT_SPAWN.z,
      DEFAULT_SPAWN.angle,
      0,
      0,
      0,
      0,
      0,
      0
    );

    // Временно: тестовая машина у вокзала.
    new Vehicle(560, 1779.3704, -1932.559, 13.3864, 270.354, 1, 1, 60, false);

    omp.on("playerDeath", (player) => {
      if (!isAuthenticated(player)) {
        return;
      }

      const id = playerId(player);
      if (id === null) {
        return;
      }

      const hospital = pickHospitalSpawn();
      pendingHospital.set(id, hospital);

      const account = getAccount(player);
      let skin = account ? resolvePlayerSkin(account) : undefined;
      if (skin === undefined) {
        try {
          skin = player.getSkin();
        } catch {
          skin = DEFAULT_SPAWN_SKIN;
        }
      }

      try {
        writeSpawnInfo(player, skin, hospital);
      } catch {
        // Игрок уже вышел.
      }

      patchAccount(player, { health: HOSPITAL_HEALTH, hospitalized: true });
      if (account) {
        void saveUserHospitalized(account.id, true, HOSPITAL_HEALTH);
      }
    });

    omp.on("playerSpawn", (player) => {
      if (!isAuthenticated(player)) {
        holdAtAuth(player);
        return;
      }

      const account = getAccount(player);
      const hospital = takePendingHospital(player);

      try {
        player.setTeam(NO_TEAM);
        applyOrgVisuals(player);
        if (account) {
          applyScore(player, account.level);
        }
        player.setCameraBehind();
      } catch {
        // Игрок уже вышел.
      }

      if (hospital) {
        try {
          placeAt(player, hospital);
          player.setHealth(HOSPITAL_HEALTH);
          refreshStreamForPlayer(player);
        } catch {
          // Игрок уже вышел.
        }

        patchAccount(player, { health: HOSPITAL_HEALTH });
        queueSave(player);

        const id = playerId(player);
        if (id !== null) {
          seenWorldSpawn.add(id);
        }

        player.sendClientMessage(Color.info, "Vy poteryali soznanie...");
        player.sendClientMessage(
          Color.gray,
          "Vrachi dostavili vas v gorodskuyu bolnicu All Saints."
        );
        player.sendClientMessage(Color.gray, "Zanimite koyku: /hospital.");
        return;
      }

      if (account?.hospitalized) {
        try {
          const point = pickHospitalSpawn();
          placeAt(player, point);
          applyHealth(player, account.health);
          refreshStreamForPlayer(player);
        } catch {
          // Игрок уже вышел.
        }

        const id = playerId(player);
        const firstSpawn = id !== null && !seenWorldSpawn.has(id);
        if (id !== null) {
          seenWorldSpawn.add(id);
        }

        if (firstSpawn) {
          applyWallet(player, account);
        }

        player.sendClientMessage(
          Color.gray,
          "Lechenie ne zakoncheno. Zanimite koyku: /hospital."
        );
        return;
      }

      const id = playerId(player);
      const firstSpawn = id !== null && !seenWorldSpawn.has(id);
      if (id !== null && firstSpawn) {
        seenWorldSpawn.add(id);
      }

      if (account && firstSpawn) {
        applyWallet(player, account);
        player.sendClientMessage(
          Color.gray,
          "Ty poyavilsya na spawne. /help — spisok komand."
        );
      }

      if (account) {
        applyHealth(player, account.health);
        if (firstSpawn) {
          const orgSpawn = resolveOrgSpawn(account);
          if (orgSpawn) {
            try {
              placeAt(player, orgSpawn);
              refreshStreamForPlayer(player);
            } catch {
              // Игрок уже вышел.
            }
          }
        }
      }
    });

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        pendingHospital.delete(id);
        seenWorldSpawn.delete(id);
      }
    });
  },
};

function takePendingHospital(player: Player): SpawnPoint | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  const hospital = pendingHospital.get(id);
  if (!hospital) {
    return null;
  }

  pendingHospital.delete(id);
  return hospital;
}
