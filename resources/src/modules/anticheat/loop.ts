import { omp, type Player, type Vehicle } from "@omp-node/core";
import {
  isPlayerActive,
  playerId,
  playerIp,
  playerName,
} from "../../shared/player";
import { isAuthenticated, getAccount } from "../auth/session";
import { AcCode } from "./codes";
import { getConfig, isCodeEnabled } from "./config";
import { checkMovement } from "./detectors/movement";
import {
  checkPingAndDos,
  noteFlood,
  onDialogResponse,
  onFireKey,
  onGiveDamage,
  onTakeDamage,
} from "./detectors/connection";
import { checkMoney, checkVitals } from "./detectors/vitals";
import {
  checkVehicleHealth,
  onEnterVehicle,
  onStateChange,
  onVehicleMod,
} from "./detectors/vehicle";
import { checkWeapons } from "./detectors/weapons";
import { decaySoftStrikes, reportCheat } from "./punish";
import {
  bumpIpConnect,
  createPlayerState,
  deletePlayerState,
  dropIpConnect,
  getPlayerState,
  markDisconnect,
  setPlayerState,
  takeReconnectGap,
} from "./state";
import {
  clearTrustedWeapons,
  markDead,
  markSpawned,
  markSpectating,
  trustArmour,
  trustHealth,
  trustMoney,
  trustPosition,
} from "./trust";

const TICK_MS = 1000;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function syncFromAccount(player: Player): void {
  const account = getAccount(player);
  if (!account) return;
  trustMoney(player, account.money);
  trustHealth(player, account.health);
  try {
    trustArmour(player, player.getArmor());
  } catch {
    trustArmour(player, 0);
  }
  try {
    const pos = player.getPos();
    trustPosition(
      player,
      pos.x,
      pos.y,
      pos.z,
      player.getInterior(),
      player.getVirtualWorld()
    );
  } catch {
    // ignore
  }
}

export function bindAnticheat(): void {
  omp.on("playerConnect", (player) => {
    const ip = playerIp(player);
    const name = playerName(player);
    const id = playerId(player);
    if (id === null) return;

    const connects = bumpIpConnect(ip);
    const cfg = getConfig();
    if (isCodeEnabled(AcCode.Sandbox) && connects > cfg.maxConnectsPerIp) {
      setPlayerState(id, createPlayerState(ip, name));
      reportCheat(player, AcCode.Sandbox, `n=${connects}`);
      return;
    }

    const gap = takeReconnectGap(ip, name);
    const state = createPlayerState(ip, name);
    if (
      gap !== null &&
      gap < cfg.reconnectMinMs &&
      isCodeEnabled(AcCode.Reconnect)
    ) {
      setPlayerState(id, state);
      reportCheat(player, AcCode.Reconnect, `gap=${gap}`);
      return;
    }

    setPlayerState(id, state);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    const ip = playerIp(player);
    const name = playerName(player);
    if (id !== null) {
      deletePlayerState(id);
    }
    dropIpConnect(ip);
    markDisconnect(ip, name);
  });

  omp.on("playerSpawn", (player) => {
    if (!isAuthenticated(player)) {
      if (isCodeEnabled(AcCode.FakeSpawn)) {
        reportCheat(player, AcCode.FakeSpawn);
      }
      return;
    }
    markSpawned(player, true);
    syncFromAccount(player);
  });

  omp.on("playerDeath", (player) => {
    markDead(player, true);
    markSpawned(player, false);
    clearTrustedWeapons(player);
  });

  omp.on("playerUpdate", (player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) return;
    const id = playerId(player);
    if (id === null) return;
    const state = getPlayerState(id);
    if (!state || !state.spawned) return;

    checkMovement(player);
    checkVitals(player);
  });

  omp.on("playerTakeDamage", (player, _issuer, amount, weaponId) => {
    onTakeDamage(player, Number(amount) || 0, Number(weaponId) || 0);
  });

  omp.on("playerGiveDamage", (player) => {
    onGiveDamage(player);
  });

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    onFireKey(player, Number(newKeys), Number(oldKeys));
  });

  omp.on("playerEnterVehicle", (player, vehicle, isPassenger) => {
    noteFlood(player, "enterVeh");
    onEnterVehicle(player, vehicle, Boolean(isPassenger));
  });

  omp.on("playerStateChange", (player, newState, oldState) => {
    noteFlood(player, "state");
    onStateChange(player, Number(newState), Number(oldState));
    if (Number(newState) === 8) {
      markSpectating(player, true);
    } else if (Number(oldState) === 8) {
      markSpectating(player, false);
    }
  });

  omp.on("dialogResponse", (player, dialogId) => {
    onDialogResponse(player, Number(dialogId));
  });

  omp.on("playerClickTextDraw", (player) => {
    noteFlood(player, "td");
  });

  omp.on("playerClickMap", (player) => {
    noteFlood(player, "map");
  });

  omp.on("vehicleMod", (player: Player, vehicle: Vehicle, component: number) => {
    onVehicleMod(player, vehicle, Number(component));
  });

  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    decaySoftStrikes();
    omp.players.forEach((player) => {
      if (!isPlayerActive(player) || !isAuthenticated(player)) return;
      const id = playerId(player);
      if (id === null) return;
      const state = getPlayerState(id);
      if (!state || !state.spawned) return;

      checkMoney(player);
      checkWeapons(player);
      checkVehicleHealth(player);
      checkPingAndDos(player);

      state.warnAirFoot = Math.max(0, state.warnAirFoot - 1);
      state.warnAirVeh = Math.max(0, state.warnAirVeh - 1);
      state.warnFly = Math.max(0, state.warnFly - 1);
      state.warnSpeedFoot = Math.max(0, state.warnSpeedFoot - 1);
      state.warnSpeedVeh = Math.max(0, state.warnSpeedVeh - 1);
      state.warnRapid = Math.max(0, state.warnRapid - 1);
    });
  }, TICK_MS);
}
