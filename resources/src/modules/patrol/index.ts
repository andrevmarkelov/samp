import {
  Dialog,
  INVALID_VEHICLE_ID,
  RaceCheckpoint,
  omp,
  type Player,
  type Vehicle,
} from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { applyWallet, getAccount, patchAccount } from "../auth/session";
import { broadcastOrgRadioFrom } from "../commands/r";
import { registerCommand } from "../commands/registry";
import { isCuffed } from "../cuff";
import { getMembership } from "../org";
import { queueSave } from "../persist";
import { isJailed } from "../prison/sentence";
import type { GameModule } from "../types";
import { isRegisteredOrgVehicle } from "../vehicles/access";
import { bindEndPatrol } from "./end";
import { patrolRouteForOrg, type PatrolPoint, type PatrolRoute } from "./route";

export const PATROL_START_DIALOG_ID = 170;
export const PATROL_ABORT_DIALOG_ID = 171;

const DIALOG_STYLE_MSGBOX = 0;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const PLAYER_STATE_WASTED = 7;
const FAIL_TEXT = "Патруль завершён без вознаграждения.";
const RACE_CP_RADIUS = 8;
const RACE_CP_NORMAL = 0;
const RACE_CP_FINISH = 1;
const CP_VERIFY_RANGE = 16;
const RETURN_SEC = 30;
const MAX_CASH = 2_147_483_647;

type PendingPatrol = {
  accountId: number;
  vehicleId: number;
};

type PatrolSession = {
  playerSlot: number;
  accountId: number;
  orgId: number;
  vehicleId: number;
  points: readonly PatrolPoint[];
  reward: number;
  rankTitle: string;
  speakerName: string;
  pointIndex: number;
  phase: "drive" | "away";
  awayTimer: ReturnType<typeof setTimeout> | null;
};

const pendingStart = new Map<number, PendingPatrol>();
const sessions = new Map<number, PatrolSession>();
const sessionByVehicle = new Map<number, number>();

export const patrolModule: GameModule = {
  name: "patrol",

  start() {
    registerCommand("patrol", "Патруль на служебном автомобиле", (player) => {
      onPatrolCommand(player);
    });

    omp.on("dialogResponse", (player, dialogId, response) => {
      const id = Number(dialogId);
      const ok = Number(response) !== 0;
      if (id === PATROL_START_DIALOG_ID) {
        onStartDialog(player, ok);
        return;
      }
      if (id === PATROL_ABORT_DIALOG_ID) {
        onAbortDialog(player, ok);
      }
    });

    omp.on("playerStateChange", (player, newState) => {
      const session = sessionOf(player);
      if (!session) {
        return;
      }

      if (newState === PLAYER_STATE_WASTED || isForcedStop(player)) {
        stopPatrol(player, session, "патруль прерван.", FAIL_TEXT, Color.error);
        return;
      }

      if (newState === PLAYER_STATE_DRIVER && isDriverOf(player, session.vehicleId)) {
        if (session.phase === "away") {
          resumePatrol(player, session);
        }
        return;
      }

      if (newState === PLAYER_STATE_PASSENGER && isInsideVehicle(player, session.vehicleId)) {
        return;
      }

      beginAway(player, session);
    });

    omp.on("playerEnterRaceCheckpoint", (player) => {
      const session = sessionOf(player);
      if (!session) {
        return;
      }
      onReachedPoint(player, session);
    });

    omp.on("playerDeath", (player) => {
      endPatrolFor(player);
    });

    omp.on("playerDisconnect", (player) => {
      const slot = playerId(player);
      if (slot !== null) {
        pendingStart.delete(slot);
      }
      const session = sessionOf(player);
      if (!session) {
        return;
      }
      stopPatrol(player, session, "патруль прерван.", null, Color.error);
    });

    omp.on("vehicleDeath", (vehicle) => {
      endForVehicle(vehicle, "патруль прерван: автомобиль уничтожен.");
    });

    omp.on("vehicleSpawn", (vehicle) => {
      endForVehicle(vehicle, "патруль прерван: автомобиль зареспавнен.");
    });
  },
};

function onPatrolCommand(player: Player): void {
  const session = sessionOf(player);
  if (session) {
    showAbortDialog(player);
    return;
  }

  const route = routeOf(player);
  if (!route) {
    return;
  }

  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках нельзя выйти в патруль.");
    return;
  }

  const vehicle = driverVehicle(player);
  if (!vehicle) {
    tell(player, Color.error, "Команду /patrol можно использовать только за рулём.");
    return;
  }

  const vehicleId = liveVehicleId(vehicle);
  const slot = playerId(player);
  const account = getAccount(player);
  if (vehicleId === null || slot === null || !account) {
    return;
  }

  if (!isRegisteredOrgVehicle(vehicle, route.orgId)) {
    tell(player, Color.error, "Это не служебный автомобиль вашей организации.");
    return;
  }

  let model = 0;
  try {
    model = Math.floor(Number(vehicle.getModel()));
  } catch {
    model = 0;
  }

  if (!route.vehicleModels.includes(model)) {
    tell(player, Color.error, "Это не патрульный автомобиль.");
    return;
  }

  const owner = sessionByVehicle.get(vehicleId);
  if (owner !== undefined && owner !== slot) {
    tell(player, Color.error, "Этот автомобиль уже на патруле.");
    return;
  }

  pendingStart.set(slot, { accountId: account.id, vehicleId });
  const reward = formatMoney(route.reward);
  try {
    Dialog.show(
      player,
      PATROL_START_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "{FFCC00}Патруль",
      `{FFFFFF}Нужно проехать по указанным точкам.\nЗа полный маршрут вы получите {33CC66}${reward}{FFFFFF}.\n\nНа первой и последней точке будет доклад в рацию. Если выйти из автомобиля и не вернуться за ${RETURN_SEC} секунд, патруль завершится без вознаграждения.`,
      "Принять",
      "Отмена"
    );
  } catch {
    pendingStart.delete(slot);
  }
}

function showAbortDialog(player: Player): void {
  try {
    Dialog.show(
      player,
      PATROL_ABORT_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "{FFCC00}Патруль",
      "{FFFFFF}Завершить патруль досрочно?\nВознаграждение не будет выдано.",
      "Принять",
      "Отмена"
    );
  } catch {
    // Диалог не открылся.
  }
}

function onStartDialog(player: Player, ok: boolean): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const pending = pendingStart.get(slot);
  pendingStart.delete(slot);
  if (!pending) {
    return;
  }

  if (!ok) {
    tell(player, Color.info, "Патруль не начат.");
    return;
  }

  const account = getAccount(player);
  const route = account ? patrolRouteForOrg(getMembership(account)?.org.id ?? 0) : null;
  if (!account || account.id !== pending.accountId || !route) {
    tell(player, Color.error, "Патруль недоступен.");
    return;
  }

  const membership = getMembership(account);
  if (!membership) {
    tell(player, Color.error, "Патруль недоступен.");
    return;
  }

  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках нельзя выйти в патруль.");
    return;
  }

  if (!isDriverOf(player, pending.vehicleId)) {
    tell(player, Color.error, "Сядьте за руль патрульного автомобиля и введите /patrol ещё раз.");
    return;
  }

  const vehicle = driverVehicle(player);
  if (!vehicle || !isRegisteredOrgVehicle(vehicle, route.orgId)) {
    tell(player, Color.error, "Это не служебный автомобиль вашей организации.");
    return;
  }

  const owner = sessionByVehicle.get(pending.vehicleId);
  if (owner !== undefined && owner !== slot) {
    tell(player, Color.error, "Этот автомобиль уже на патруле.");
    return;
  }

  const session: PatrolSession = {
    playerSlot: slot,
    accountId: account.id,
    orgId: route.orgId,
    vehicleId: pending.vehicleId,
    points: route.points,
    reward: route.reward,
    rankTitle: membership.rank.title,
    speakerName: playerChatName(player),
    pointIndex: 0,
    phase: "drive",
    awayTimer: null,
  };
  sessions.set(slot, session);
  sessionByVehicle.set(pending.vehicleId, slot);
  setPatrolCheckpoint(player, session);
  tell(player, Color.info, "Патруль начат. Следуйте по чекпоинтам.");
}

function onAbortDialog(player: Player, ok: boolean): void {
  const session = sessionOf(player);
  if (!session) {
    return;
  }

  if (!ok) {
    tell(player, Color.info, "Патруль продолжается.");
    return;
  }

  stopPatrol(
    player,
    session,
    "снимаюсь с патруля.",
    "Патруль завершён. Вознаграждение не выдано.",
    Color.info
  );
}

function onReachedPoint(player: Player, session: PatrolSession): void {
  if (session.phase !== "drive") {
    return;
  }

  if (!sameAccount(player, session) || !isDriverOf(player, session.vehicleId)) {
    return;
  }

  const point = session.points[session.pointIndex];
  if (!point || !nearPoint(player, point)) {
    return;
  }

  if (!rankTitle(player, session.orgId)) {
    stopPatrol(
      player,
      session,
      "патруль прерван.",
      "Вы больше не состоите в организации. Патруль завершён.",
      Color.error
    );
    return;
  }

  const last = session.pointIndex >= session.points.length - 1;
  if (session.pointIndex === 0) {
    report(player, session, "заступаю в патруль.");
  }

  if (last) {
    report(player, session, "патруль завершён.");
    const paid = pay(player, session.reward);
    clearSession(player, session);
    tell(player, Color.info, `Патруль завершён. Вознаграждение: ${formatMoney(paid)}.`);
    return;
  }

  session.pointIndex += 1;
  setPatrolCheckpoint(player, session);
}

function beginAway(player: Player, session: PatrolSession): void {
  if (session.phase === "away") {
    return;
  }

  session.phase = "away";
  if (session.awayTimer) {
    clearTimeout(session.awayTimer);
    session.awayTimer = null;
  }

  const slot = session.playerSlot;
  // Следующий тик: смерть и тюрьма в этом же вызове успевают закрыть патруль без текста про 30 секунд.
  session.awayTimer = setTimeout(() => {
    session.awayTimer = null;
    const current = sessions.get(slot);
    if (!current || current !== session || current.phase !== "away") {
      return;
    }

    const live = omp.players.at(slot);
    if (!live || !isPlayerActive(live)) {
      clearSession(null, session);
      return;
    }

    if (isForcedStop(live)) {
      stopPatrol(live, session, "патруль прерван.", FAIL_TEXT, Color.error);
      return;
    }

    if (isDriverOf(live, session.vehicleId)) {
      session.phase = "drive";
      setPatrolCheckpoint(live, session);
      return;
    }

    tell(
      live,
      Color.error,
      `Вы покинули автомобиль. Вернитесь за руль в течение ${RETURN_SEC} секунд, иначе патруль будет завершён без вознаграждения.`
    );

    session.awayTimer = setTimeout(() => {
      session.awayTimer = null;
      const still = sessions.get(slot);
      if (!still || still !== session || still.phase !== "away") {
        return;
      }

      const person = omp.players.at(slot);
      if (!person || !isPlayerActive(person)) {
        clearSession(null, session);
        return;
      }

      if (isForcedStop(person)) {
        stopPatrol(person, session, "патруль прерван.", FAIL_TEXT, Color.error);
        return;
      }

      if (isDriverOf(person, session.vehicleId)) {
        session.phase = "drive";
        setPatrolCheckpoint(person, session);
        return;
      }

      stopPatrol(
        person,
        session,
        "патруль прерван, не вернулся в автомобиль.",
        "Патруль завершён: вы не вернулись в автомобиль. Вознаграждение не выдано.",
        Color.error
      );
    }, RETURN_SEC * 1000);
  }, 0);
}

function resumePatrol(player: Player, session: PatrolSession): void {
  if (session.awayTimer) {
    clearTimeout(session.awayTimer);
    session.awayTimer = null;
  }

  session.phase = "drive";
  setPatrolCheckpoint(player, session);
  tell(player, Color.info, "Вы вернулись в автомобиль. Продолжайте патруль.");
}

function endForVehicle(vehicle: Vehicle, reportBody: string): void {
  const vehicleId = liveVehicleId(vehicle);
  if (vehicleId === null) {
    return;
  }

  const slot = sessionByVehicle.get(vehicleId);
  if (slot === undefined) {
    return;
  }

  const session = sessions.get(slot);
  if (!session) {
    sessionByVehicle.delete(vehicleId);
    return;
  }

  const live = omp.players.at(slot);
  if (live && isPlayerActive(live)) {
    stopPatrol(live, session, reportBody, FAIL_TEXT, Color.error);
    return;
  }

  stopPatrol(null, session, reportBody, null, Color.error);
}

function endPatrolFor(player: Player): void {
  const slot = playerId(player);
  if (slot !== null) {
    pendingStart.delete(slot);
  }

  const session = sessionOf(player);
  if (!session) {
    return;
  }

  stopPatrol(player, session, "патруль прерван.", FAIL_TEXT, Color.error);
}

bindEndPatrol(endPatrolFor);

function stopPatrol(
  player: Player | null,
  session: PatrolSession,
  reportBody: string,
  text: string | null,
  color: number
): void {
  if (!sessions.has(session.playerSlot)) {
    return;
  }

  report(player, session, reportBody);
  clearSession(player, session);
  if (text && player) {
    tell(player, color, text);
  }
}

function report(player: Player | null, session: PatrolSession, body: string): void {
  if (player) {
    const account = getAccount(player);
    const membership = account ? getMembership(account) : null;
    if (membership && membership.org.id === session.orgId) {
      session.rankTitle = membership.rank.title;
      session.speakerName = playerChatName(player);
    }
  }

  broadcastOrgRadioFrom(
    session.orgId,
    session.rankTitle,
    session.speakerName,
    `Докладывает ${session.rankTitle}, ${body}`,
    player
  );
}

function isForcedStop(player: Player): boolean {
  if (isJailed(player)) {
    return true;
  }

  try {
    return player.getState() === PLAYER_STATE_WASTED || player.getHealth() <= 0;
  } catch {
    return false;
  }
}

function pay(player: Player, amount: number): number {
  const account = getAccount(player);
  if (!account || amount <= 0) {
    return 0;
  }

  const next = Math.max(0, Math.min(MAX_CASH, Math.floor(account.money + amount)));
  const paid = next - account.money;
  if (paid <= 0) {
    return 0;
  }

  patchAccount(player, { money: next });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
  return paid;
}

function setPatrolCheckpoint(player: Player, session: PatrolSession): void {
  const point = session.points[session.pointIndex];
  if (!point) {
    return;
  }

  const last = session.pointIndex >= session.points.length - 1;
  const next = last ? point : session.points[session.pointIndex + 1] ?? point;

  try {
    RaceCheckpoint.set(
      player,
      last ? RACE_CP_FINISH : RACE_CP_NORMAL,
      point.x,
      point.y,
      point.z,
      next.x,
      next.y,
      next.z,
      RACE_CP_RADIUS
    );
  } catch {
    // Слот пустой.
  }

  const slot = session.playerSlot;
  const index = session.pointIndex;
  setTimeout(() => {
    const current = sessions.get(slot);
    if (!current || current !== session || current.pointIndex !== index || current.phase !== "drive") {
      return;
    }
    const live = omp.players.at(slot);
    if (!live || !isPlayerActive(live)) {
      return;
    }
    if (nearPoint(live, point)) {
      onReachedPoint(live, current);
    }
  }, 0);
}

function clearSession(player: Player | null, session: PatrolSession): void {
  if (session.awayTimer) {
    clearTimeout(session.awayTimer);
    session.awayTimer = null;
  }

  sessions.delete(session.playerSlot);
  if (sessionByVehicle.get(session.vehicleId) === session.playerSlot) {
    sessionByVehicle.delete(session.vehicleId);
  }

  if (!player || !isPlayerActive(player)) {
    return;
  }

  try {
    RaceCheckpoint.disable(player);
  } catch {
    // Уже снят.
  }
}

function routeOf(player: Player): PatrolRoute | null {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в организации.");
    return null;
  }

  const route = patrolRouteForOrg(membership.org.id);
  if (!route) {
    tell(player, Color.error, "Патруль для вашей организации пока недоступен.");
    return null;
  }

  return route;
}

function sessionOf(player: Player): PatrolSession | null {
  const slot = playerId(player);
  if (slot === null) {
    return null;
  }
  return sessions.get(slot) ?? null;
}

function sameAccount(player: Player, session: PatrolSession): boolean {
  const account = getAccount(player);
  return !!account && account.id === session.accountId;
}

function rankTitle(player: Player, orgId: number): string | null {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || !membership || membership.org.id !== orgId) {
    return null;
  }
  return membership.rank.title;
}

function nearPoint(player: Player, point: PatrolPoint): boolean {
  const vehicle = driverVehicle(player);
  if (!vehicle) {
    return false;
  }

  try {
    const pos = vehicle.getPos();
    return Math.hypot(pos.x - point.x, pos.y - point.y, pos.z - point.z) <= CP_VERIFY_RANGE;
  } catch {
    return false;
  }
}

function isDriverOf(player: Player, vehicleId: number): boolean {
  try {
    return player.getState() === PLAYER_STATE_DRIVER && player.getVehicleID() === vehicleId;
  } catch {
    return false;
  }
}

function isInsideVehicle(player: Player, vehicleId: number): boolean {
  try {
    return player.getVehicleID() === vehicleId;
  } catch {
    return false;
  }
}

function driverVehicle(player: Player): Vehicle | null {
  try {
    if (player.getState() !== PLAYER_STATE_DRIVER) {
      return null;
    }
    return omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return null;
  }
}

function liveVehicleId(vehicle: Vehicle): number | null {
  try {
    const id = vehicle.getID();
    if (id === null || id === undefined || id === INVALID_VEHICLE_ID) {
      return null;
    }
    const numeric = Number(id);
    return Number.isInteger(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (!isPlayerActive(player)) {
      return;
    }
    player.sendClientMessage(color, text);
  } catch {
    // Слот пустой.
  }
}
