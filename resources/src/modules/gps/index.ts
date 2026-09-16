import { Checkpoint, Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { isMinerOnShift } from "../miner";
import type { GameModule } from "../types";

export const GPS_DIALOG_ID = 7;

const DIALOG_STYLE_LIST = 2;
const GPS_ICON_SLOT = 2;
const GPS_ICON_TYPE = 0;
const GPS_ICON_COLOR = 0xff0000ff;
const MAPICON_GLOBAL = 1;
const ARRIVE_RADIUS = 8;
const CHECKPOINT_RADIUS = 4;
const TICK_MS = 200;

type GpsTarget = {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
};

const TARGETS: readonly GpsTarget[] = [
  { key: "hall", label: "Meriya", x: 1481.1039, y: -1767.4878, z: 18.7958 },
  {
    key: "hospital",
    label: "Gorodskaya bolnica",
    x: 1177.869,
    y: -1323.4761,
    z: 14.092,
  },
  {
    key: "mine",
    label: "Shakhta",
    x: 1023.8627,
    y: -368.1405,
    z: 73.8935,
  },
  {
    key: "station",
    label: "ZHD LS",
    x: 1814.2401,
    y: -1889.4424,
    z: 13.4141,
  },
  {
    key: "prison",
    label: "Tyurma",
    x: 1810.8636,
    y: -1576.4412,
    z: 13.5167,
  },
];

const activeByPlayer = new Map<number, GpsTarget>();

export const gpsModule: GameModule = {
  name: "gps",
  start() {
    setInterval(tickGps, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearRoute(player, id);
      }
    });
  },
};

export function showGpsMenu(player: Player): void {
  const id = playerId(player);
  if (id !== null && activeByPlayer.has(id)) {
    clearRoute(player, id);
    player.sendClientMessage(Color.gray, "Vy otklyuchili GPS.");
    return;
  }

  const body = TARGETS.map((target) => target.label).join("\n");
  try {
    Dialog.show(
      player,
      GPS_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "GPS",
      body,
      "Vybrat'",
      "Zakryt'"
    );
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' otkryt' GPS.");
  }
}

export function bindGpsDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== GPS_DIALOG_ID) {
      return;
    }

    if (Number(response) === 0) {
      return;
    }

    const target = pickTarget(Number(listItem), String(inputText ?? ""));
    if (!target) {
      showGpsMenu(player);
      return;
    }

    setRoute(player, target);
  });
}

function pickTarget(listItem: number, inputText: string): GpsTarget | null {
  const raw = inputText.trim().toLowerCase();
  const byLabel = TARGETS.find((target) => target.label.toLowerCase() === raw);
  if (byLabel) {
    return byLabel;
  }

  return TARGETS[listItem] ?? null;
}

function setRoute(player: Player, target: GpsTarget): void {
  const id = playerId(player);
  if (id === null || !isAuthenticated(player)) {
    return;
  }

  let pos;
  try {
    pos = player.getPos();
    player.setMapIcon(
      GPS_ICON_SLOT,
      target.x,
      target.y,
      target.z,
      GPS_ICON_TYPE,
      GPS_ICON_COLOR,
      MAPICON_GLOBAL
    );
    if (!isMinerOnShift(player)) {
      Checkpoint.set(player, target.x, target.y, target.z, CHECKPOINT_RADIUS);
    }
  } catch {
    player.sendClientMessage(Color.error, "Ne udalos' postavit' metku.");
    return;
  }

  activeByPlayer.set(id, target);

  const meters = Math.round(
    Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z)
  );
  player.sendClientMessage(
    Color.info,
    `Metka: ${target.label}. Distantsiya: ${meters} m.`
  );
}

function tickGps(): void {
  omp.players.forEach((player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    const target = activeByPlayer.get(id);
    if (!target || !isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const dist = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z);
      if (dist <= ARRIVE_RADIUS) {
        arrive(player);
        return;
      }

      if (!isMinerOnShift(player) && !Checkpoint.isActive(player)) {
        Checkpoint.set(player, target.x, target.y, target.z, CHECKPOINT_RADIUS);
      }
    } catch {
      // Игрок уже вышел.
    }
  });
}

function arrive(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const target = activeByPlayer.get(id);
  if (!target) {
    return;
  }

  clearRoute(player, id);
  player.sendClientMessage(
    Color.info,
    `Vy pribyli k mestu: ${target.label}.`
  );
}

function clearRoute(player: Player, id: number): void {
  activeByPlayer.delete(id);
  try {
    player.removeMapIcon(GPS_ICON_SLOT);
    if (!isMinerOnShift(player)) {
      Checkpoint.disable(player);
    }
  } catch {
    // Игрок уже вышел.
  }
}
