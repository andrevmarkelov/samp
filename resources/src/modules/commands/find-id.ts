import { Checkpoint, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { isAutoschoolExamOnRoute } from "../autoschool/session";
import { getBusiness } from "../businesses/repository";
import { clearGpsRouteForPlayer, setFindIdMarkClearer } from "../gps";
import { getHouse } from "../houses/repository";
import { isLoaderOnShift } from "../loader";
import { isMinerOnShift } from "../miner";
import { isArmyAmmoCarrying } from "../vehicles/army-ammo-delivery";
import { isHospitalMedDeliveryActive } from "../vehicles/hospital";
import { registerCommand } from "./registry";

const CHECKPOINT_RADIUS = 4;
const ARRIVE_RADIUS = 8;
const TICK_MS = 200;
/** Тот же слот, что у GPS — одновременно одна метка маршрута. */
const MAP_ICON_SLOT = 2;
const MAP_ICON_TYPE = 0;
const MAP_ICON_COLOR = 0xff0000ff;
const MAPICON_GLOBAL = 1;

type FindKind = "house" | "biz";

type FindMark = {
  kind: FindKind;
  entityId: number;
  label: string;
  x: number;
  y: number;
  z: number;
};

const activeByPlayer = new Map<number, FindMark>();

function canUseCheckpoint(player: Player): boolean {
  return (
    !isMinerOnShift(player) &&
    !isLoaderOnShift(player) &&
    !isAutoschoolExamOnRoute(player) &&
    !isHospitalMedDeliveryActive(player) &&
    !isArmyAmmoCarrying(player)
  );
}

function parseId(args: string): number | null {
  const raw = args.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
}

export function clearFindIdMarkForPlayer(player: Player): void {
  const slot = playerId(player);
  if (slot === null || !activeByPlayer.has(slot)) {
    return;
  }

  clearMark(player, slot);
}

function clearMark(player: Player, slot: number): void {
  activeByPlayer.delete(slot);
  try {
    player.removeMapIcon(MAP_ICON_SLOT);
    if (canUseCheckpoint(player)) {
      Checkpoint.disable(player);
    }
  } catch {
    // Уже вышел.
  }
}

function setMark(player: Player, mark: FindMark): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  // Общий слот иконки/чекпоинта с GPS.
  clearGpsRouteForPlayer(player);

  let pos;
  try {
    pos = player.getPos();
    player.setMapIcon(
      MAP_ICON_SLOT,
      mark.x,
      mark.y,
      mark.z,
      MAP_ICON_TYPE,
      MAP_ICON_COLOR,
      MAPICON_GLOBAL
    );
    if (canUseCheckpoint(player)) {
      Checkpoint.set(player, mark.x, mark.y, mark.z, CHECKPOINT_RADIUS);
    }
  } catch {
    player.sendClientMessage(Color.error, "Не удалось поставить метку.");
    return;
  }

  activeByPlayer.set(slot, mark);
  const meters = Math.round(
    Math.hypot(pos.x - mark.x, pos.y - mark.y, pos.z - mark.z)
  );
  player.sendClientMessage(
    Color.info,
    `Метка: ${mark.label}. Дистанция: ${meters} m.`
  );
}

function handleFind(
  player: Player,
  kind: FindKind,
  args: string,
  usage: string
): void {
  if (!isAuthenticated(player)) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const entityId = parseId(args);
  if (entityId === null) {
    player.sendClientMessage(Color.error, usage);
    return;
  }

  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const current = activeByPlayer.get(slot);
  if (current && current.kind === kind && current.entityId === entityId) {
    clearMark(player, slot);
    player.sendClientMessage(Color.gray, "Метка отключена.");
    return;
  }

  if (kind === "house") {
    const house = getHouse(entityId);
    if (!house) {
      player.sendClientMessage(Color.error, `Дом №${entityId} не найден.`);
      return;
    }

    setMark(player, {
      kind,
      entityId,
      label: `Дом №${house.id}`,
      x: house.entranceX,
      y: house.entranceY,
      z: house.entranceZ,
    });
    return;
  }

  const business = getBusiness(entityId);
  if (!business) {
    player.sendClientMessage(Color.error, `Бизнес №${entityId} не найден.`);
    return;
  }

  setMark(player, {
    kind,
    entityId,
    label: `Бизнес №${business.id}: ${business.name}`,
    x: business.entranceX,
    y: business.entranceY,
    z: business.entranceZ,
  });
}

function tickFindMarks(): void {
  omp.players.forEach((player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    const mark = activeByPlayer.get(slot);
    if (!mark || !isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const dist = Math.hypot(pos.x - mark.x, pos.y - mark.y, pos.z - mark.z);
      if (dist <= ARRIVE_RADIUS) {
        clearMark(player, slot);
        player.sendClientMessage(
          Color.info,
          `Вы прибыли к месту: ${mark.label}.`
        );
        return;
      }

      if (canUseCheckpoint(player) && !Checkpoint.isActive(player)) {
        Checkpoint.set(player, mark.x, mark.y, mark.z, CHECKPOINT_RADIUS);
      }
    } catch {
      // Игрок уже вышел.
    }
  });
}

registerCommand("findidhouse", "Метка на дом по ID", (player, args) => {
  handleFind(player, "house", args, "Использование: /findidhouse [id]");
});

registerCommand("findidbiz", "Метка на бизнес по ID", (player, args) => {
  handleFind(player, "biz", args, "Использование: /findidbiz [id]");
});

export function bindFindIdMarks(): void {
  setFindIdMarkClearer(clearFindIdMarkForPlayer);
  setInterval(tickFindMarks, TICK_MS);

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot !== null) {
      activeByPlayer.delete(slot);
    }
  });
}
