import { Checkpoint, Dialog, omp, Pickup, TextDraw, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { CHAT_MAX_LENGTH, clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { WEAPON_SLOTS, weaponSlot } from "../anticheat/codes";
import {
  clearTrustedWeapons,
  grantArmour,
  grantWeapon,
  markSpectating,
  setTrustedHealth,
  trustPosition,
} from "../anticheat/trust";
import { applyHealth, applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { isCuffed } from "../cuff";
import { applyOrgVisuals } from "../org/appearance";
import { queueSave } from "../persist";
import { isJailed } from "../prison/sentence";
import { refreshStreamForPlayer } from "../mapping/stream";
import { clearPlaceAtSettle, NO_TEAM, placeAt, STREET_WORLD, type SpawnPoint } from "../spawn/point";
import { registerCommand } from "../commands/registry";
import {
  entertainmentGpsNumber,
  formatClock,
  nextRegistrationOpen,
  registerScheduledEvent,
} from "./schedule";
import { isEventParticipant, setEventDisconnectHook, setEventParticipant } from "./state";
import { onEventLeave } from "./commands";
import { runStartCountdown } from "./countdown";

export const CS_REGISTER_DIALOG_ID = 173;
export const CS_LEAVE_DIALOG_ID = 174;

const DIALOG_STYLE_MSGBOX = 0;
const PICKUP_TYPE = 1;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 400;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;
const SPECTATE_MODE_NORMAL = 1;
/** Совпадает с MapVirtualWorld в maps/cs.txt. Объекты карты в interior 1. */
const CS_WORLD = 22;
const CS_INTERIOR = 1;
const MIN_LEVEL = 3;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const FEE = 20_000;
const ROUNDS_TO_WIN = 10;
const ROUND_PAUSE_MS = 5_000;
const EVENT_NOTICE = 0x00ffa4ff;
/** Ждём соседние смерти, чтобы размен в одном моменте не отдал раунд одной стороне. */
const ROUND_RESOLVE_MS = 800;
const MAX_CASH = 2_147_483_647;
const FULL = 100;
const SNIPER_AMMO = 20;
const PISTOL_AMMO = 70;
const RIFLE_AMMO = 120;
const WEAPON_DEAGLE = 24;
const WEAPON_AK47 = 30;
const WEAPON_M4 = 31;
const WEAPON_SNIPER = 34;
const TEAM_CT = 1;
const TEAM_T = 2;
const SKIN_CT = 285;
const SKIN_T = 109;
const COLOR_CT = 0x33cc33ff;
const COLOR_T = 0xff3333ff;

const GPS_POINT = { x: 416.4834, y: -1430.7191, z: 32.4797 } as const;
const PICKUP_POINT = { x: 419.4713, y: -1428.5809, z: 32.4948 } as const;
const PICKUP_MODEL = 19131;

const CT_SPAWNS = [
  { x: 3852.3079, y: 1416.9088, z: 792.2917, angle: 0.955 },
  { x: 3851.9336, y: 1420.6891, z: 792.2917, angle: 0.955 },
  { x: 3847.8347, y: 1415.8086, z: 792.2917, angle: 358.4483 },
  { x: 3847.8533, y: 1421.5537, z: 792.2917, angle: 358.4483 },
  { x: 3844.2346, y: 1416.0782, z: 792.2917, angle: 2.2084 },
  { x: 3844.0916, y: 1419.8064, z: 792.2917, angle: 2.2084 },
  { x: 3840.5056, y: 1415.1039, z: 792.2917, angle: 0.015 },
  { x: 3840.1553, y: 1418.5509, z: 792.2917, angle: 0.015 },
  { x: 3840.1553, y: 1421.8536, z: 792.2917, angle: 0.015 },
  { x: 3848.3035, y: 1422.2937, z: 792.2917, angle: 2.5218 },
] as const;

const T_SPAWNS = [
  { x: 3986.2837, y: 1366.3206, z: 801.0078, angle: 0.0149 },
  { x: 3986.2466, y: 1370.9304, z: 801.0078, angle: 0.0149 },
  { x: 3986.1062, y: 1376.3724, z: 801.0078, angle: 0.0149 },
  { x: 3986.1062, y: 1381.0681, z: 801.0078, angle: 0.0149 },
  { x: 3981.5239, y: 1366.3223, z: 801.0078, angle: 359.7016 },
  { x: 3981.5513, y: 1371.6716, z: 801.0078, angle: 359.7016 },
  { x: 3981.5842, y: 1378.0233, z: 801.0078, angle: 359.7016 },
  { x: 3975.2832, y: 1366.0416, z: 801.0078, angle: 355.6283 },
  { x: 3975.3354, y: 1371.9874, z: 801.0078, angle: 355.6283 },
  { x: 3975.6489, y: 1377.728, z: 801.0078, angle: 355.6283 },
] as const;

type TeamId = "ct" | "t";
type Phase = "idle" | "registration" | "freeze" | "round" | "pause";

type SavedWeapon = { id: number; ammo: number };

type Fighter = {
  team: TeamId;
  spawnIndex: number;
  dead: boolean;
  specCursor: number;
  specTarget: number | null;
  weapons: SavedWeapon[];
  armor: number;
  feePaid: boolean;
  name: string;
};

const fighters = new Map<number, Fighter>();
const onPickup = new Set<number>();
const vitals = new Map<number, { hp: number; armor: number }>();

let phase: Phase = "idle";
let roundNumber = 0;
let scoreCt = 0;
let scoreT = 0;
let pot = 0;
let timerToken = 0;
let stopCountdown: (() => void) | null = null;
/** До первого сигнала старта взнос ещё возвращается. Между раундами уже нет. */
let matchStarted = false;
let bound = false;

const RETURN_POINT: SpawnPoint = {
  x: GPS_POINT.x,
  y: GPS_POINT.y,
  z: GPS_POINT.z,
  angle: 0,
  interior: 0,
  world: STREET_WORLD,
};

export function bindCounterStrike(): void {
  if (bound) {
    return;
  }
  bound = true;
  startCsHud();

  registerScheduledEvent({
    id: "cs",
    name: "Counter-Strike",
    parity: "even",
    openRegistration,
    closeRegistration,
  });
  setEventDisconnectHook(onDisconnect);

  new Pickup(PICKUP_MODEL, PICKUP_TYPE, PICKUP_POINT.x, PICKUP_POINT.y, PICKUP_POINT.z, STREET_WORLD);
  setInterval(tickCs, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response) => {
    const id = Number(dialogId);
    const ok = Number(response) !== 0;
    if (id === CS_REGISTER_DIALOG_ID) {
      if (ok) {
        confirmRegister(player);
      }
      return;
    }
    if (id === CS_LEAVE_DIALOG_ID && ok) {
      leaveMatch(player, true);
    }
  });

  omp.on("playerDeath", (player, killer) => {
    const fighter = fighterOf(player);
    const killerFighter = killer ? fighterOf(killer) : undefined;
    if (fighter && killerFighter && fighter.team === killerFighter.team) {
      reviveAtSpawn(player, fighter, phase === "round" || phase === "freeze");
      return;
    }
    onFightDeath(player);
  });

  omp.on("playerTakeDamage", (player, from) => {
    const fighter = fighterOf(player);
    const attacker = from ? fighterOf(from) : undefined;
    if (!fighter || fighter.dead || !attacker || attacker.team !== fighter.team) {
      return;
    }
    restoreVitals(player);
  });

  omp.on("playerSpawn", (player) => {
    const id = playerId(player);
    const fighter = id === null ? undefined : fighters.get(id);
    if (!fighter || !isEventParticipant(player)) {
      return;
    }
    try {
      player.setTeam(fighter.team === "ct" ? TEAM_CT : TEAM_T);
    } catch {
      // Игрок уже вышел.
    }
    if (fighter.dead && (phase === "round" || phase === "pause" || phase === "freeze")) {
      beginSpectate(player, fighter, false);
    }
  });

  registerCommand("team", "Чат своей команды на мероприятии", (player, args) => {
    sayTeam(player, args);
  });
  onEventLeave(askLeave);
  registerCommand("spec", "Сменить цель слежки на мероприятии", (player) => {
    cycleSpectate(player);
  });
}

function openRegistration(startAt: number): void {
  if (phase !== "idle") {
    return;
  }
  phase = "registration";
  matchStarted = false;
  roundNumber = 0;
  scoreCt = 0;
  scoreT = 0;
  pot = 0;
  const item = entertainmentGpsNumber();
  const gps = item > 0 ? String(item) : "Развлечения";
  announce(
    EVENT_NOTICE,
    `Через 10 минут начинаются Counter-Strike. Регистрация на месте {73ACAC}(/gps ${gps})`
  );
  void startAt;
}

function closeRegistration(startAt: number): void {
  void startAt;
  if (phase !== "registration") {
    return;
  }
  if (fighters.size < MIN_PLAYERS) {
    cancelRegistration();
    return;
  }
  announce(Color.white, "Counter-Strike начался. Спецназ против террористов, игра до 10 раундов.");
  beginRound();
}

function cancelRegistration(): void {
  announce(
    EVENT_NOTICE,
    "Мероприятие Counter-Strike отменено: не набралось игроков. Взнос за регистрацию возвращён."
  );
  for (const id of [...fighters.keys()]) {
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      releaseFighter(player, "return", true);
    } else {
      fighters.delete(id);
      vitals.delete(id);
    }
  }
  pot = 0;
  phase = "idle";
  matchStarted = false;
  cancelTimers();
}

function tickCs(): void {
  if (phase === "registration" || phase === "freeze" || phase === "pause") {
    for (const [id, fighter] of fighters) {
      if (fighter.dead) {
        continue;
      }
      const player = omp.players.at(id);
      if (!player || !isPlayerActive(player)) {
        continue;
      }
      try {
        player.setTeam(fighter.team === "ct" ? TEAM_CT : TEAM_T);
        player.toggleControllable(false);
      } catch {
        // Уже вышел.
      }
    }
  }

  if (phase === "round") {
    for (const [id, fighter] of fighters) {
      if (fighter.dead) {
        continue;
      }
      const player = omp.players.at(id);
      if (!player || !isPlayerActive(player)) {
        continue;
      }
      try {
        player.setTeam(fighter.team === "ct" ? TEAM_CT : TEAM_T);
      } catch {
        // Уже вышел.
      }
      rememberVitals(player, id);
    }
  }

  for (const id of [...fighters.keys()]) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    const fighter = fighters.get(id);
    if (fighter?.dead && (phase === "round" || phase === "pause")) {
      try {
        const state = player.getState();
        if (
          state === PLAYER_STATE_ONFOOT ||
          state === 2 ||
          state === 3
        ) {
          beginSpectate(player, fighter, false);
        }
      } catch {
        // Уже вышел.
      }
    }
    if (phase === "idle" || !fighters.has(id) || !shouldEject(player)) {
      continue;
    }
    tellOthers(id, `${leftLine(fighter)} покинул игру.`);
    releaseFighter(player, isJailed(player) ? "jail" : "eject", feeReturns());
    watchTeams();
    refreshSpectators();
  }

  for (const id of [...onPickup]) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      onPickup.delete(id);
    }
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player) || isEventParticipant(player)) {
      return;
    }
    const id = playerId(player);
    if (id === null) {
      return;
    }
    try {
      if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
        onPickup.delete(id);
        return;
      }
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        onPickup.delete(id);
        return;
      }
      const pos = player.getPos();
      const near =
        Math.hypot(pos.x - PICKUP_POINT.x, pos.y - PICKUP_POINT.y, pos.z - PICKUP_POINT.z) <=
        PICKUP_RADIUS;
      if (!near) {
        onPickup.delete(id);
        return;
      }
      if (onPickup.has(id)) {
        return;
      }
      onPickup.add(id);
      offerRegistration(player);
    } catch {
      // Слот пустой.
    }
  });
}

function offerRegistration(player: Player): void {
  if (phase !== "registration") {
    if (phase === "idle") {
      tell(
        player,
        Color.info,
        `Регистрация на Counter-Strike откроется в ${formatClock(nextRegistrationOpen())}.`
      );
      return;
    }
    tell(player, Color.error, "Регистрация на Counter-Strike уже закрыта.");
    return;
  }
  if (fighters.size >= MAX_PLAYERS) {
    tell(player, Color.error, "На Counter-Strike больше нет мест. Максимум 20 игроков.");
    return;
  }
  if (isJailed(player)) {
    tell(player, Color.error, "Из тюрьмы на мероприятие не попасть.");
    return;
  }
  if (isCuffed(player)) {
    tell(player, Color.error, "В наручниках зарегистрироваться нельзя.");
    return;
  }

  const account = getAccount(player);
  if (!account || account.level < MIN_LEVEL) {
    tell(player, Color.error, "На мероприятия пускают с 3 уровня.");
    return;
  }

  try {
    Dialog.show(
      player,
      CS_REGISTER_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Counter-Strike",
      [
        "Две команды: спецназ и террористы. Нужно уничтожить состав противника.",
        `Игра до ${ROUNDS_TO_WIN} раундов. Своих убить нельзя.`,
        "",
        `Участие с ${MIN_LEVEL} уровня. Взнос ${formatMoney(FEE)}.`,
        "Если игроков меньше двух, мероприятие отменят и взнос вернут.",
        "До старта можно выйти: /leave.",
        "",
        "Зарегистрироваться?",
      ].join("\n"),
      "Да",
      "Нет"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть регистрацию.");
  }
}

function confirmRegister(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }
  if (phase !== "registration") {
    tell(player, Color.error, "Регистрация уже закрыта.");
    return;
  }
  const id = playerId(player);
  if (id === null || fighters.has(id)) {
    tell(player, Color.error, "Вы уже записаны на Counter-Strike.");
    return;
  }
  if (fighters.size >= MAX_PLAYERS) {
    tell(player, Color.error, "На Counter-Strike больше нет мест.");
    return;
  }
  if (isJailed(player) || isCuffed(player)) {
    tell(player, Color.error, "Сейчас зарегистрироваться нельзя.");
    return;
  }
  if (!atRegistration(player)) {
    tell(player, Color.error, "Подойдите к месту регистрации.");
    return;
  }
  const account = getAccount(player);
  if (!account || account.level < MIN_LEVEL) {
    tell(player, Color.error, "На мероприятия пускают с 3 уровня.");
    return;
  }
  if (account.money < FEE) {
    tell(player, Color.error, `Нужно ${formatMoney(FEE)} наличными.`);
    return;
  }
  if (!takeFee(player)) {
    tell(player, Color.error, "Не удалось списать взнос.");
    return;
  }

  const team = nextTeam();
  const fighter: Fighter = {
    team,
    spawnIndex: takeSpawn(team),
    dead: false,
    specCursor: 0,
    specTarget: null,
    weapons: snapshotWeapons(player),
    armor: readArmor(player),
    feePaid: true,
    name: playerChatName(player),
  };
  pot += FEE;
  fighters.set(id, fighter);
  stripWeapons(player);
  try {
    if (player.isInAnyVehicle()) {
      player.removeFromVehicle();
    }
  } catch {
    // Пешком.
  }
  placeFighter(player, fighter, false);
  setEventParticipant(player, true);
  try {
    Checkpoint.disable(player);
  } catch {
    // Метки нет.
  }
  const teamName = teamLabel(team);
  tell(
    player,
    team === "ct" ? COLOR_CT : COLOR_T,
    `Вы в команде «${teamName}». Ждите конца регистрации на точке спавна. /leave — выйти и вернуть взнос. /team — чат команды.`
  );
  paintScore();
  showCsHud(player);
}

function beginRound(): void {
  cancelTimers();
  if (fighters.size < MIN_PLAYERS || countTeam("ct") === 0 || countTeam("t") === 0) {
    finishBecauseEmpty();
    return;
  }
  roundNumber += 1;
  phase = "freeze";
  paintScore();
  for (const [id, fighter] of fighters) {
    fighter.dead = false;
    fighter.specCursor = 0;
    fighter.specTarget = null;
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    stopSpectate(player);
    placeFighter(player, fighter, true);
  }
  tellEvent(
    `Раунд ${roundNumber}. Счёт: спецназ ${scoreCt} — террористы ${scoreT}. Старт через 5 секунд.`
  );
  stopCountdown = runStartCountdown(
    () => phase === "freeze",
    () => {
      const list: Player[] = [];
      for (const id of fighters.keys()) {
        const player = omp.players.at(id);
        if (player && isPlayerActive(player)) {
          list.push(player);
        }
      }
      return list;
    },
    () => {
      stopCountdown = null;
      if (phase !== "freeze") {
        return;
      }
      matchStarted = true;
      phase = "round";
      for (const [id, fighter] of fighters) {
        if (fighter.dead) {
          continue;
        }
        const player = omp.players.at(id);
        if (!player || !isPlayerActive(player) || isCuffed(player)) {
          continue;
        }
        try {
          player.toggleControllable(true);
        } catch {
          // Уже вышел.
        }
      }
      tellEvent("Раунд начался.");
    }
  );
}

function onFightDeath(player: Player): void {
  const id = playerId(player);
  const fighter = id === null ? undefined : fighters.get(id);
  if (!fighter || phase === "idle") {
    return;
  }
  fighter.name = playerChatName(player);
  if (phase !== "round") {
    reviveAtSpawn(player, fighter, phase === "freeze");
    return;
  }
  fighter.dead = true;
  fighter.specTarget = null;
  stripWeapons(player);
  later(ROUND_RESOLVE_MS, resolveRound);
  if (beginSpectate(player, fighter, true)) {
    tell(
      player,
      Color.info,
      "Вы погибли. /spec меняет, за кем следить: сначала своя команда, затем противник."
    );
  }
  refreshSpectators();
}

function resolveRound(): void {
  if (phase !== "round") {
    return;
  }
  const ct = aliveCount("ct");
  const t = aliveCount("t");
  if (ct > 0 && t > 0) {
    return;
  }
  if (ct === 0 && t === 0) {
    phase = "pause";
    roundNumber = Math.max(0, roundNumber - 1);
    tellEvent("Раунд без победителя: никого не осталось. Раунд играется заново.");
    later(ROUND_PAUSE_MS, beginRound);
    return;
  }
  scoreRound(ct === 0 ? "t" : "ct");
}

function scoreRound(winner: TeamId): void {
  if (phase !== "round") {
    return;
  }
  if (winner === "ct") {
    scoreCt += 1;
  } else {
    scoreT += 1;
  }
  phase = "pause";
  paintScore();
  freezeLiving();
  tellEvent(
    `Раунд за ${teamLabel(winner).toLowerCase()}. Счёт: спецназ ${scoreCt} — террористы ${scoreT}.`
  );
  if (scoreCt >= ROUNDS_TO_WIN || scoreT >= ROUNDS_TO_WIN) {
    later(ROUND_PAUSE_MS, () => finishMatch(scoreCt >= ROUNDS_TO_WIN ? "ct" : "t"));
    return;
  }
  later(ROUND_PAUSE_MS, beginRound);
}

function finishMatch(winner: TeamId): void {
  if (phase === "idle") {
    return;
  }
  cancelTimers();
  matchStarted = false;
  const roster = [...fighters.entries()];
  phase = "idle";
  const winnerCount = roster.filter(([id, fighter]) => {
    const player = omp.players.at(id);
    return fighter.team === winner && fighter.feePaid && player !== undefined && isPlayerActive(player);
  }).length;
  const loserPot = Math.max(0, pot - winnerCount * FEE);
  const share = winnerCount > 0 ? FEE + Math.floor(loserPot / winnerCount) : 0;
  let leftover = winnerCount > 0 ? loserPot % winnerCount : 0;
  announce(
    Color.white,
    `Counter-Strike окончен. Победили ${teamLabel(winner).toLowerCase()}, счёт ${scoreCt}:${scoreT}.`
  );
  for (const [id, fighter] of roster) {
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      fighters.delete(id);
      vitals.delete(id);
      continue;
    }
    const won = fighter.team === winner;
    releaseFighter(player, "return", false);
    if (won && share > 0) {
      const bonus = leftover > 0 ? 1 : 0;
      if (bonus > 0) {
        leftover -= 1;
      }
      const paid = giveCash(player, share + bonus);
      if (paid > 0) {
        const extra = Math.max(0, paid - FEE);
        tell(
          player,
          Color.tryOk,
          extra > 0
            ? `Победа. Вы получили ${formatMoney(paid)}: взнос вернулся, сверху ${formatMoney(extra)} из взносов проигравших.`
            : `Победа. Вы получили ${formatMoney(paid)}.`
        );
      }
    } else if (!won && fighter.feePaid) {
      tell(player, Color.error, `Команда проиграла. Взнос ${formatMoney(FEE)} уходит победителям.`);
    }
  }
  pot = 0;
  phase = "idle";
  roundNumber = 0;
  scoreCt = 0;
  scoreT = 0;
}

function finishBecauseEmpty(): void {
  const ct = countTeam("ct");
  const t = countTeam("t");
  if (ct > 0 && t === 0) {
    finishMatch("ct");
    return;
  }
  if (t > 0 && ct === 0) {
    finishMatch("t");
    return;
  }
  if (fighters.size === 0) {
    pot = 0;
    phase = "idle";
    matchStarted = false;
    cancelTimers();
    return;
  }
  announce(Color.info, "Counter-Strike остановлен: в командах не осталось игроков. Взнос возвращён.");
  for (const id of [...fighters.keys()]) {
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      releaseFighter(player, "return", true);
    } else {
      fighters.delete(id);
      vitals.delete(id);
    }
  }
  pot = 0;
  phase = "idle";
  matchStarted = false;
  cancelTimers();
}

function watchTeams(): void {
  if (phase === "idle" || phase === "registration") {
    return;
  }
  const ct = countTeam("ct");
  const t = countTeam("t");
  if (ct === 0 && t === 0) {
    finishBecauseEmpty();
    return;
  }
  if (ct === 0 || t === 0) {
    finishMatch(ct === 0 ? "t" : "ct");
    return;
  }
  if (phase === "round") {
    resolveRound();
  }
}

function askLeave(player: Player): boolean {
  const fighter = fighterOf(player);
  if (!fighter) {
    return false;
  }
  const refund = feeReturns() ? "Взнос вернут." : "Взнос не вернут.";
  try {
    Dialog.show(
      player,
      CS_LEAVE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Выход",
      `Покинуть Counter-Strike? Вас вернут к месту регистрации. ${refund}`,
      "Выйти",
      "Остаться"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть окно.");
  }
  return true;
}

function leaveMatch(player: Player, asked: boolean): void {
  const fighter = fighterOf(player);
  if (!fighter) {
    return;
  }
  const refund = feeReturns();
  tellOthers(idOf(player), `${leftLine(fighter)} покинул игру.`);
  releaseFighter(player, "return", refund);
  if (asked) {
    tell(
      player,
      Color.info,
      refund ? "Вы покинули Counter-Strike. Взнос возвращён." : "Вы покинули Counter-Strike."
    );
  }
  watchTeams();
  refreshSpectators();
}

function sayTeam(player: Player, args: string): void {
  const fighter = fighterOf(player);
  if (!fighter) {
    tell(player, Color.error, "Командный чат доступен только на мероприятии. /team [текст]");
    return;
  }
  const text = sanitizeChatText(args.trim()).slice(0, CHAT_MAX_LENGTH);
  if (!text) {
    tell(player, Color.error, "Использование: /team [текст]");
    return;
  }
  fighter.name = playerChatName(player);
  const line = clipClientMessage(`[${teamLabel(fighter.team)}] ${fighter.name}: ${text}`);
  const color = fighter.team === "ct" ? COLOR_CT : COLOR_T;
  for (const [id, other] of fighters) {
    if (other.team !== fighter.team) {
      continue;
    }
    const target = omp.players.at(id);
    if (target && isPlayerActive(target)) {
      tell(target, color, line);
    }
  }
}

function cycleSpectate(player: Player): void {
  const fighter = fighterOf(player);
  if (!fighter || !fighter.dead || phase === "idle" || phase === "registration") {
    tell(player, Color.error, "Слежка доступна после гибели в раунде.");
    return;
  }
  fighter.specCursor += 1;
  if (!beginSpectate(player, fighter, true)) {
    tell(player, Color.error, "Смотреть пока не на кого.");
  }
}

function beginSpectate(player: Player, fighter: Fighter, announce: boolean): boolean {
  const targets = spectateTargets(fighter);
  if (targets.length === 0) {
    return false;
  }
  const target = targets[fighter.specCursor % targets.length];
  if (!target) {
    return false;
  }
  try {
    markSpectating(player, true);
    player.toggleSpectating(true);
    player.spectatePlayer(target, SPECTATE_MODE_NORMAL);
    fighter.specTarget = playerId(target);
    const other = fighterOf(target);
    if (announce && other) {
      tell(player, Color.gray, `Слежка: ${teamLabel(other.team)} ${other.name}. /spec — следующий.`);
    }
    return true;
  } catch {
    return false;
  }
}

function stopSpectate(player: Player): void {
  try {
    if (player.getState() === PLAYER_STATE_SPECTATING) {
      player.toggleSpectating(false);
    }
  } catch {
    // Уже в игре.
  }
  markSpectating(player, false);
}

function endMatchSpectate(player: Player): void {
  try {
    if (player.getState() === PLAYER_STATE_SPECTATING) {
      const skin = player.getSkin();
      player.setSpawnInfo(
        NO_TEAM,
        skin,
        RETURN_POINT.x,
        RETURN_POINT.y,
        RETURN_POINT.z,
        RETURN_POINT.angle,
        0,
        0,
        0,
        0,
        0,
        0
      );
    }
  } catch {
    // Уже вышел.
  }
  stopSpectate(player);
}

function placeFighter(player: Player, fighter: Fighter, fight: boolean): void {
  const point = spawnPoint(fighter);
  stopSpectate(player);
  try {
    placeAt(player, point);
    player.setSpawnInfo(
      fighter.team === "ct" ? TEAM_CT : TEAM_T,
      fighter.team === "ct" ? SKIN_CT : SKIN_T,
      point.x,
      point.y,
      point.z,
      point.angle,
      0,
      0,
      0,
      0,
      0,
      0
    );
    player.setTeam(fighter.team === "ct" ? TEAM_CT : TEAM_T);
    player.setSkin(fighter.team === "ct" ? SKIN_CT : SKIN_T);
    player.setColor(fighter.team === "ct" ? COLOR_CT : COLOR_T);
    player.toggleControllable(false);
    refreshStreamForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
  setTrustedHealth(player, FULL);
  grantArmour(player, FULL);
  if (fight) {
    giveLoadout(player, fighter.team);
  }
  trustPosition(player, point.x, point.y, point.z, point.interior, point.world);
}

function releaseFighter(
  player: Player,
  how: "return" | "eject" | "jail",
  refund: boolean
): void {
  const id = playerId(player);
  const fighter = id === null ? undefined : fighters.get(id);
  if (!fighter || id === null) {
    return;
  }
  const sendHome =
    how === "return" || (how === "eject" && isCuffed(player) && (fighter.dead || inCsArena(player)));
  fighters.delete(id);
  vitals.delete(id);
  hideCsHud(player);
  clearPlaceAtSettle(player);
  endMatchSpectate(player);
  const account = getAccount(player);

  if (how === "jail") {
    stripWeapons(player);
    try {
      player.setTeam(NO_TEAM);
      applyOrgVisuals(player);
    } catch {
      // Уже вышел.
    }
    setEventParticipant(player, false);
    if (!isCuffed(player)) {
      try {
        player.toggleControllable(true);
      } catch {
        // Уже вышел.
      }
    }
    if (refund && fighter.feePaid) {
      fighter.feePaid = false;
      pot = Math.max(0, pot - FEE);
      giveCash(player, FEE);
    }
    return;
  }

  restoreWeapons(player, fighter.weapons);
  if (account) {
    applyHealth(player, account.health);
  }
  grantArmour(player, fighter.armor);
  try {
    player.setTeam(NO_TEAM);
    applyOrgVisuals(player);
    if (!isCuffed(player)) {
      player.toggleControllable(true);
    }
  } catch {
    // Уже вышел.
  }
  setEventParticipant(player, false);
  if (sendHome) {
    try {
      placeAt(player, RETURN_POINT, { settleMs: false });
      refreshStreamForPlayer(player);
    } catch {
      // Уже вышел.
    }
  }
  if (refund && fighter.feePaid) {
    fighter.feePaid = false;
    pot = Math.max(0, pot - FEE);
    giveCash(player, FEE);
  } else if (fighter.feePaid && how !== "return") {
    fighter.feePaid = false;
  }
}

function onDisconnect(player: Player): void {
  const id = playerId(player);
  const fighter = id === null ? undefined : fighters.get(id);
  if (!fighter || id === null) {
    return;
  }
  fighter.name = playerChatName(player);
  const refund = feeReturns() && fighter.feePaid;
  if (refund) {
    const account = getAccount(player);
    if (account) {
      patchAccount(player, { money: Math.min(MAX_CASH, account.money + FEE) });
    }
    pot = Math.max(0, pot - FEE);
    fighter.feePaid = false;
  }
  tellOthers(id, `${leftLine(fighter)} покинул игру.`);
  onPickup.delete(id);
  fighters.delete(id);
  vitals.delete(id);
  hideCsHud(player);
  if (phase === "idle" || phase === "registration" || fighters.size === 0) {
    if (fighters.size === 0 && phase !== "registration" && phase !== "idle") {
      pot = 0;
      phase = "idle";
      matchStarted = false;
      cancelTimers();
    }
    return;
  }
  watchTeams();
  refreshSpectators();
}

function shouldEject(player: Player): boolean {
  if (isJailed(player) || isCuffed(player)) {
    return true;
  }
  const fighter = fighterOf(player);
  if (fighter?.dead) {
    return false;
  }
  try {
    const state = player.getState();
    if (state === PLAYER_STATE_SPECTATING || state === PLAYER_STATE_WASTED) {
      return false;
    }
    return player.getVirtualWorld() !== CS_WORLD || player.getInterior() !== CS_INTERIOR;
  } catch {
    return false;
  }
}

function rememberVitals(player: Player, id: number): void {
  try {
    const hp = player.getHealth();
    if (hp <= 0) {
      return;
    }
    vitals.set(id, { hp, armor: Math.max(0, player.getArmor()) });
  } catch {
    // Игрок уже вышел.
  }
}

function restoreVitals(player: Player): void {
  const id = playerId(player);
  const saved = id === null ? undefined : vitals.get(id);
  setTrustedHealth(player, saved?.hp && saved.hp > 0 ? saved.hp : FULL);
  grantArmour(player, saved?.armor ?? FULL);
}

function reviveAtSpawn(player: Player, fighter: Fighter, fight: boolean): void {
  fighter.dead = false;
  fighter.specTarget = null;
  const id = playerId(player);
  setTimeout(() => {
    if (!isPlayerActive(player) || id === null || fighters.get(id) !== fighter || phase === "idle") {
      return;
    }
    if (fighter.dead || (!fight && phase === "round")) {
      return;
    }
    try {
      player.spawn();
    } catch {
      // Уже в игре.
    }
    placeFighter(player, fighter, fight && (phase === "round" || phase === "freeze"));
    restoreVitals(player);
    if (phase === "round" && fight && !isCuffed(player)) {
      try {
        player.toggleControllable(true);
      } catch {
        // Уже вышел.
      }
    }
  }, 100);
}

function giveLoadout(player: Player, team: TeamId): void {
  stripWeapons(player);
  const rifle = team === "ct" ? WEAPON_M4 : WEAPON_AK47;
  grantWeapon(player, WEAPON_DEAGLE, PISTOL_AMMO);
  grantWeapon(player, rifle, RIFLE_AMMO);
  grantWeapon(player, WEAPON_SNIPER, SNIPER_AMMO);
  try {
    player.setArmedWeapon(rifle);
  } catch {
    // Оружие уже в руках после выдачи.
  }
}

function stripWeapons(player: Player): void {
  try {
    player.resetWeapons();
  } catch {
    // Уже пусто.
  }
  clearTrustedWeapons(player);
}

function restoreWeapons(player: Player, weapons: SavedWeapon[]): void {
  stripWeapons(player);
  for (const weapon of weapons) {
    if (weapon.id > 0 && weapon.ammo > 0) {
      grantWeapon(player, weapon.id, weapon.ammo);
    }
  }
}

function snapshotWeapons(player: Player): SavedWeapon[] {
  const saved: SavedWeapon[] = [];
  for (let slot = 0; slot < WEAPON_SLOTS; slot += 1) {
    try {
      const data = player.getWeaponData(slot) as {
        weaponid?: number;
        weapons?: number;
        weapon?: number;
        ammo?: number;
      };
      const id = Number(data.weaponid ?? data.weapons ?? data.weapon ?? 0);
      const ammo = Number(data.ammo ?? 0);
      if (id > 0 && ammo > 0 && weaponSlot(id) === slot) {
        saved.push({ id, ammo });
      }
    } catch {
      // Слот недоступен.
    }
  }
  return saved;
}

function spectateTargets(fighter: Fighter): Player[] {
  const same: Player[] = [];
  const other: Player[] = [];
  for (const [id, candidate] of fighters) {
    if (candidate.dead) {
      continue;
    }
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player) || playerId(player) === null) {
      continue;
    }
    if (fighters.get(playerId(player) ?? -1) === fighter) {
      continue;
    }
    if (candidate.team === fighter.team) {
      same.push(player);
    } else {
      other.push(player);
    }
  }
  return [...same, ...other];
}

function spawnPoint(fighter: Fighter): SpawnPoint {
  const list = fighter.team === "ct" ? CT_SPAWNS : T_SPAWNS;
  const base = list[fighter.spawnIndex % list.length] ?? list[0];
  const overflow = Math.floor(fighter.spawnIndex / list.length);
  return {
    x: (base?.x ?? 0) + overflow * 0.8,
    y: base?.y ?? 0,
    z: base?.z ?? 0,
    angle: base?.angle ?? 0,
    interior: CS_INTERIOR,
    world: CS_WORLD,
  };
}

function takeSpawn(team: TeamId): number {
  const used = new Set(
    [...fighters.values()].filter((fighter) => fighter.team === team).map((fighter) => fighter.spawnIndex)
  );
  const count = team === "ct" ? CT_SPAWNS.length : T_SPAWNS.length;
  for (let index = 0; index < count; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return used.size;
}

function nextTeam(): TeamId {
  return countTeam("ct") <= countTeam("t") ? "ct" : "t";
}

function countTeam(team: TeamId): number {
  let count = 0;
  for (const fighter of fighters.values()) {
    if (fighter.team === team) {
      count += 1;
    }
  }
  return count;
}

function aliveCount(team: TeamId): number {
  let count = 0;
  for (const fighter of fighters.values()) {
    if (fighter.team === team && !fighter.dead) {
      count += 1;
    }
  }
  return count;
}

function fighterOf(player: Player): Fighter | undefined {
  const id = playerId(player);
  if (id === null) {
    return undefined;
  }
  return fighters.get(id);
}

function atRegistration(player: Player): boolean {
  try {
    if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
      return false;
    }
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return false;
    }
    const pos = player.getPos();
    return (
      Math.hypot(pos.x - PICKUP_POINT.x, pos.y - PICKUP_POINT.y, pos.z - PICKUP_POINT.z) <=
      PICKUP_RADIUS
    );
  } catch {
    return false;
  }
}

function inCsArena(player: Player): boolean {
  try {
    return player.getVirtualWorld() === CS_WORLD && player.getInterior() === CS_INTERIOR;
  } catch {
    return false;
  }
}

function spectateStillValid(fighter: Fighter): boolean {
  if (fighter.specTarget === null) {
    return false;
  }
  const target = fighters.get(fighter.specTarget);
  return target !== undefined && !target.dead;
}

function refreshSpectators(): void {
  if (phase === "idle" || phase === "registration") {
    return;
  }
  for (const [id, fighter] of fighters) {
    if (!fighter.dead || spectateStillValid(fighter)) {
      continue;
    }
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      beginSpectate(player, fighter, false);
    }
  }
}

function paintScore(): void {
  updateCsHud(roundNumber, ROUNDS_TO_WIN, scoreCt, scoreT);
}

function teamLabel(team: TeamId): string {
  return team === "ct" ? "Спецназ" : "Террористы";
}

function leftLine(fighter: Fighter | undefined): string {
  if (!fighter) {
    return "[Игрок]";
  }
  return `[${teamLabel(fighter.team)}] Игрок ${fighter.name}`;
}

function takeFee(player: Player): boolean {
  const account = getAccount(player);
  if (!account || account.money < FEE) {
    return false;
  }
  patchAccount(player, { money: account.money - FEE });
  const updated = getAccount(player);
  if (updated) {
    applyWallet(player, updated);
  }
  queueSave(player);
  return true;
}

function giveCash(player: Player, amount: number): number {
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

function readArmor(player: Player): number {
  try {
    return Math.max(0, player.getArmor());
  } catch {
    return 0;
  }
}

function freezeLiving(): void {
  for (const [id, fighter] of fighters) {
    if (fighter.dead) {
      continue;
    }
    const player = omp.players.at(id);
    if (!player || !isPlayerActive(player)) {
      continue;
    }
    try {
      player.toggleControllable(false);
    } catch {
      // Уже вышел.
    }
  }
}

function feeReturns(): boolean {
  return phase === "registration" || (phase !== "idle" && !matchStarted);
}

function later(ms: number, action: () => void): void {
  const token = ++timerToken;
  setTimeout(() => {
    if (token !== timerToken) {
      return;
    }
    action();
  }, ms);
}

function cancelTimers(): void {
  timerToken += 1;
  stopCountdown?.();
  stopCountdown = null;
}

function idOf(player: Player): number | null {
  return playerId(player);
}

function tellOthers(skipId: number | null, text: string): void {
  for (const id of fighters.keys()) {
    if (id === skipId) {
      continue;
    }
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      tell(player, Color.info, text);
    }
  }
}

function tellEvent(text: string): void {
  for (const id of fighters.keys()) {
    const player = omp.players.at(id);
    if (player && isPlayerActive(player)) {
      tell(player, Color.info, text);
    }
  }
}

function announce(color: number, text: string): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }
    try {
      if (player.isNPC()) {
        return;
      }
    } catch {
      return;
    }
    tell(player, color, text);
  });
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, clipClientMessage(text));
  } catch {
    // Игрок уже вышел.
  }
}

const HUD_TIME_COLOR = 0x00cc00aa;
const HUD_LINE_COLOR = 0xffffffaa;
const HUD_BACK_COLOR = 0x000000aa;
const HUD_BOX_COLOR = 102;

type CsHud = {
  round: TextDraw;
  counterTerrorists: TextDraw;
  terrorists: TextDraw;
  box: TextDraw;
};

let scoreHud: CsHud | null = null;

function tryHudDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function styleHudLine(draw: TextDraw, color: number): void {
  draw.setAlignment(0);
  draw.setBackgroundColor(HUD_BACK_COLOR);
  draw.setFont(1);
  draw.setOutline(1);
  draw.setLetterSize(0.32, 1.6);
  draw.setColor(color);
  draw.setProportional(true);
  draw.setShadow(0);
  draw.setSelectable(false);
}

function startCsHud(): boolean {
  if (scoreHud) {
    return true;
  }

  const box = tryHudDraw(() => {
    const draw = new TextDraw(3.0, 275.0, "_");
    draw.setLetterSize(0.5, 5.899998);
    draw.setTextSize(145.0, 0.0);
    draw.setAlignment(1);
    draw.setColor(0);
    draw.setUseBox(true);
    draw.setBoxColor(HUD_BOX_COLOR);
    draw.setOutline(0);
    draw.setShadow(0);
    draw.setFont(0);
    draw.setSelectable(false);
    return draw;
  });
  const round = tryHudDraw(() => {
    const draw = new TextDraw(13.0, 278.0, "Round: 0/10");
    styleHudLine(draw, HUD_TIME_COLOR);
    return draw;
  });
  const counterTerrorists = tryHudDraw(() => {
    const draw = new TextDraw(13.0, 295.0, "Counter-Terrorists: ~g~0");
    styleHudLine(draw, HUD_LINE_COLOR);
    return draw;
  });
  const terrorists = tryHudDraw(() => {
    const draw = new TextDraw(13.0, 310.0, "Terrorists: ~r~0");
    styleHudLine(draw, HUD_LINE_COLOR);
    return draw;
  });

  if (!box || !round || !counterTerrorists || !terrorists) {
    box?.destroy();
    round?.destroy();
    counterTerrorists?.destroy();
    terrorists?.destroy();
    return false;
  }

  scoreHud = { box, round, counterTerrorists, terrorists };
  return true;
}

function updateCsHud(round: number, roundsToWin: number, ct: number, terrorists: number): void {
  if (!scoreHud) {
    return;
  }

  try {
    scoreHud.round.setString(`Round: ${round}/${roundsToWin}`);
    scoreHud.counterTerrorists.setString(`Counter-Terrorists: ~g~${ct}`);
    scoreHud.terrorists.setString(`Terrorists: ~r~${terrorists}`);
  } catch {
    // TextDraw уже уничтожен.
  }
}

function showCsHud(player: Player): void {
  if (!scoreHud || !isPlayerActive(player)) {
    return;
  }

  try {
    scoreHud.box.showForPlayer(player);
    scoreHud.round.showForPlayer(player);
    scoreHud.counterTerrorists.showForPlayer(player);
    scoreHud.terrorists.showForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

function hideCsHud(player: Player): void {
  if (!scoreHud) {
    return;
  }

  try {
    scoreHud.box.hideForPlayer(player);
    scoreHud.round.hideForPlayer(player);
    scoreHud.counterTerrorists.hideForPlayer(player);
    scoreHud.terrorists.hideForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}
