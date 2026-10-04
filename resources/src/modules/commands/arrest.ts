import { Checkpoint, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { CHAT_RADIUS, WHISPER_RADIUS, arePlayersNearby, sendNearby } from "../../shared/nearby";
import {
  isPlayerActive,
  playerChatName,
  playerId,
  playerName,
} from "../../shared/player";
import { byGender } from "../auth/gender";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { isCuffed } from "../cuff";
import {
  ORG_FBI_ID,
  getMembership,
  isLawOfficer,
  notifyLawStaff,
} from "../org";
import { queueSave } from "../persist";
import { applyJail, isJailed } from "../prison/sentence";
import { STREET_WORLD } from "../spawn/point";
import { resolveLawNearbyTarget } from "./law-target";
import { registerCommand } from "./registry";

/** Как у добровольной сдачи: 1★ = 10 мин. */
const MINUTES_PER_WANTED = 10;
const REWARD_PER_STAR = 500;
const STATION_RADIUS = 10;
const CHECKPOINT_RADIUS = 4;
const PENDING_TTL_MS = 10 * 60 * 1000;
const PLAYER_STATE_DRIVER = 2;

type ArrestStation = {
  key: string;
  name: string;
  x: number;
  y: number;
  z: number;
};

/** Точки сдачи у гаражей участков. */
const STATIONS: readonly ArrestStation[] = [
  {
    key: "police",
    name: "Областная полиция",
    x: 626.0856,
    y: -590.1869,
    z: 16.7614,
  },
  {
    key: "lspd",
    name: "LSPD",
    x: 1529.2043,
    y: -1678.8394,
    z: 5.8906,
  },
];

type PendingArrest = {
  targetSlot: number;
  targetAccountId: number;
  station: ArrestStation;
  expiresAt: number;
};

const pending = new Map<number, PendingArrest>();
const busy = new Set<number>();

registerCommand(
  "arrest",
  "Арестовать игрока у участка (полиция / FBI)",
  (player, args) => {
    const resolved = resolveLawNearbyTarget(
      player,
      args,
      "Использование: /arrest [id]"
    );
    if (!resolved.ok) {
      return;
    }

    const { officer, target, officerId, targetId } = resolved;
    const station = nearestStation(officer);
    if (!station) {
      officer.sendClientMessage(
        Color.error,
        "Арестовать можно только рядом с участком LSPD или Областной полиции."
      );
      return;
    }

    if (isLawOfficer(target)) {
      officer.sendClientMessage(
        Color.error,
        "Нельзя арестовать сотрудника полиции или FBI."
      );
      return;
    }

    if (isJailed(target)) {
      officer.sendClientMessage(Color.error, "Игрок уже в тюрьме.");
      return;
    }

    if (!isCuffed(target)) {
      officer.sendClientMessage(Color.error, "На игроке должны быть наручники.");
      return;
    }

    const targetAccount = getAccount(target);
    if (!targetAccount || targetAccount.wantedLevel <= 0) {
      officer.sendClientMessage(Color.error, "У игрока нет розыска.");
      return;
    }

    if (isTargetPending(targetId, targetAccount.id)) {
      officer.sendClientMessage(
        Color.error,
        "Этого игрока уже ведут на арест."
      );
      return;
    }

    if (!arePlayersNearby(officer, target, WHISPER_RADIUS)) {
      officer.sendClientMessage(Color.error, "Игрок слишком далеко.");
      return;
    }

    // Сбрасываем прошлый арест вместе с CP (иначе при ошибке set останется чужой маркер).
    clearPending(officerId, true);

    try {
      Checkpoint.set(
        officer,
        station.x,
        station.y,
        station.z,
        CHECKPOINT_RADIUS
      );
    } catch {
      officer.sendClientMessage(Color.error, "Не удалось поставить чекпоинт.");
      return;
    }

    pending.set(officerId, {
      targetSlot: targetId,
      targetAccountId: targetAccount.id,
      station,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });

    const officerName = playerName(officer);
    const targetName = playerName(target);
    const verb = byGender(
      getAccount(officer)?.gender ?? null,
      "повёл",
      "повела"
    );

    sendNearby(
      officer,
      CHAT_RADIUS,
      Color.action,
      `${officerName} ${verb} ${targetName} в участок (${station.name}).`
    );

    officer.sendClientMessage(
      Color.info,
      `Задержанный: ${targetName}. Заедьте на чекпоинт у ${station.name}, чтобы завершить арест.`
    );
    try {
      target.sendClientMessage(
        Color.error,
        `${officerName} ведёт вас в участок (${station.name}).`
      );
    } catch {
      // Уже вышел.
    }

    // Если уже за рулём с задержанным в радиусе CP — enter может не прийти повторно.
    void onArrestCheckpoint(officer, true);
  }
);

export function bindArrestCheckpoints(): void {
  omp.on("playerEnterCheckpoint", (player) => {
    void onArrestCheckpoint(player, false);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      clearPending(id, false);
      clearPendingByTarget(id);
    }
  });

  omp.on("playerDeath", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    clearPending(id, true);
    clearPendingByTarget(id);
  });
}

async function onArrestCheckpoint(
  player: Player,
  silentIfNotReady: boolean
): Promise<void> {
  const officerId = playerId(player);
  if (officerId === null || !isAuthenticated(player) || !isLawOfficer(player)) {
    return;
  }

  const state = pending.get(officerId);
  if (!state) {
    return;
  }

  if (Date.now() > state.expiresAt) {
    clearPending(officerId, true);
    tell(player, Color.error, "Время на арест истекло. Начните заново: /arrest.");
    return;
  }

  if (busy.has(officerId)) {
    return;
  }

  let vehicleId = -1;
  try {
    if (!player.isInAnyVehicle() || player.getState() !== PLAYER_STATE_DRIVER) {
      if (!silentIfNotReady) {
        tell(player, Color.error, "Завершить арест можно только за рулём.");
      }
      return;
    }
    vehicleId = player.getVehicleID();
  } catch {
    if (!silentIfNotReady) {
      tell(player, Color.error, "Завершить арест можно только за рулём.");
    }
    return;
  }

  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    if (!silentIfNotReady) {
      tell(player, Color.error, "Завершить арест можно только за рулём.");
    }
    return;
  }

  if (!isNearStation(player, state.station, CHECKPOINT_RADIUS + 2)) {
    return;
  }

  const target = omp.players.at(state.targetSlot);
  const targetAccount = target ? getAccount(target) : null;
  if (
    !target ||
    !isPlayerActive(target) ||
    !isAuthenticated(target) ||
    !targetAccount ||
    targetAccount.id !== state.targetAccountId
  ) {
    clearPending(officerId, true);
    tell(player, Color.error, "Задержанный вышел из игры. Арест отменён.");
    return;
  }

  if (isLawOfficer(target) || isJailed(target)) {
    clearPending(officerId, true);
    tell(player, Color.error, "Арест больше недоступен.");
    return;
  }

  if (!isCuffed(target)) {
    clearPending(officerId, true);
    tell(player, Color.error, "С задержанного сняли наручники. Арест отменён.");
    return;
  }

  if (targetAccount.wantedLevel <= 0) {
    clearPending(officerId, true);
    tell(player, Color.error, "У задержанного нет розыска. Арест отменён.");
    return;
  }

  try {
    if (!target.isInAnyVehicle() || target.getVehicleID() !== vehicleId) {
      if (!silentIfNotReady) {
        tell(
          player,
          Color.error,
          "Задержанный должен быть в вашем транспорте (/putpl)."
        );
      }
      return;
    }
  } catch {
    clearPending(officerId, true);
    tell(player, Color.error, "Задержанный вышел из игры. Арест отменён.");
    return;
  }

  const wanted = targetAccount.wantedLevel;
  const minutes = arrestMinutes(wanted);
  const reward = wanted * REWARD_PER_STAR;

  busy.add(officerId);
  try {
    const ok = await applyJail(target, minutes);
    if (!ok) {
      tell(player, Color.error, "Не удалось посадить игрока. Попробуйте ещё раз.");
      return;
    }

    setPlayerWantedLevel(target, 0);
    clearPending(officerId, true);

    payOfficer(player, reward);

    const officerAccount = getAccount(player);
    const membership = officerAccount ? getMembership(officerAccount) : null;
    const rankTitle = membership?.rank.title ?? lawFallbackRank(player);
    const officerLabel = playerChatName(player);
    const targetLabel = playerChatName(target);
    const verb = byGender(
      officerAccount?.gender ?? null,
      "посадил",
      "посадила"
    );

    notifyLawStaff(
      `Диспетчер: ${rankTitle} ${officerLabel} ${verb} ${targetLabel} в тюрьму (${state.station.name}).`
    );

    sendNearby(
      player,
      CHAT_RADIUS,
      Color.action,
      `${playerName(player)} ${verb} ${playerName(target)} в тюрьму.`
    );

    tell(
      player,
      Color.info,
      `Вы посадили ${playerName(target)}. Срок: ${minutes} мин. Награда: ${formatMoney(reward)}.`
    );

    try {
      target.sendClientMessage(
        Color.error,
        `Вас арестовал ${playerName(player)}. Розыск снят.`
      );
    } catch {
      // Уже в тюрьме / вышел.
    }
  } finally {
    busy.delete(officerId);
  }
}

function nearestStation(player: Player): ArrestStation | null {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return null;
    }

    const pos = player.getPos();
    let best: ArrestStation | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const station of STATIONS) {
      const dist = Math.hypot(pos.x - station.x, pos.y - station.y, pos.z - station.z);
      if (dist <= STATION_RADIUS && dist < bestDist) {
        best = station;
        bestDist = dist;
      }
    }

    return best;
  } catch {
    return null;
  }
}

function isNearStation(
  player: Player,
  station: ArrestStation,
  radius: number
): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(pos.x - station.x, pos.y - station.y, pos.z - station.z) <= radius
    );
  } catch {
    return false;
  }
}

function arrestMinutes(wantedLevel: number): number {
  return Math.max(1, Math.floor(wantedLevel)) * MINUTES_PER_WANTED;
}

function isTargetPending(targetSlot: number, targetAccountId: number): boolean {
  for (const state of pending.values()) {
    if (
      state.targetSlot === targetSlot ||
      state.targetAccountId === targetAccountId
    ) {
      return true;
    }
  }
  return false;
}

function clearPending(officerId: number, disableCp: boolean): void {
  if (!pending.delete(officerId)) {
    return;
  }

  if (!disableCp) {
    return;
  }

  const officer = omp.players.at(officerId);
  if (!officer || !isPlayerActive(officer)) {
    return;
  }

  try {
    Checkpoint.disable(officer);
  } catch {
    // Уже вышел.
  }
}

function clearPendingByTarget(targetSlot: number): void {
  for (const [officerId, state] of pending) {
    if (state.targetSlot !== targetSlot) {
      continue;
    }

    clearPending(officerId, true);
    const officer = omp.players.at(officerId);
    if (officer && isPlayerActive(officer)) {
      tell(officer, Color.error, "Задержанный выбыл. Арест отменён.");
    }
  }
}

function payOfficer(player: Player, amount: number): void {
  const account = getAccount(player);
  if (!account || amount <= 0) {
    return;
  }

  patchAccount(player, { money: account.money + amount });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
}

function lawFallbackRank(player: Player): string {
  const account = getAccount(player);
  const orgId = account ? getMembership(account)?.org.id : undefined;
  return orgId === ORG_FBI_ID ? "Агент" : "Офицер";
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пуст.
  }
}
