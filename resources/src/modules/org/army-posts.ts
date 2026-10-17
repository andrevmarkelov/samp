import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { queueSave } from "../persist";
import { getAccount, isAuthenticated, applyWallet, patchAccount } from "../auth/session";
import { isCuffed } from "../cuff";
import { STREET_WORLD } from "../spawn/point";
import { ORG_ARMY_ID } from "./army";
import { getMembership } from "./membership";
import { registerCommand } from "../commands/registry";

export const ARMY_POST_LEAVE_DIALOG_ID = 164;
export const ARMY_POST_LIST_DIALOG_ID = 165;

const PICKUP_MODEL = 19273;
const PICKUP_TYPE = 1;
const DIALOG_STYLE_MSGBOX = 0;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

const KEY_WALK = 1024;
const STAND_RADIUS = 1.8;
const LEAVE_RADIUS = 5;
const TICK_MS = 200;
const LABEL_MS = 1000;
const PAY_MS = 5 * 60 * 1000;
const PAY_AMOUNT = 300;
const MAX_MONEY = 2_000_000_000;

const LABEL_HEIGHT = 1.15;
const LABEL_DRAW_DISTANCE = 30;

const DENY = "Посты только для сотрудников Армии.";

type PostDef = {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
};

type Duty = {
  slotId: number;
  userId: number;
  /** Имя на момент заступления, чтобы надпись не перескочила на новый слот. */
  labelName: string;
  since: number;
  paidTicks: number;
};

const POSTS: readonly PostDef[] = [
  { id: 1, name: "КПП №1", x: 2722.1174, y: -2397.8513, z: 13.6328 },
  { id: 2, name: "КПП №2", x: 2722.231, y: -2510.1531, z: 13.6641 },
  { id: 3, name: "Вышка №1", x: 2726.1682, y: -2337.2815, z: 29.6514 },
  { id: 4, name: "Вышка №2", x: 2804.6057, y: -2339.0967, z: 29.6514 },
  { id: 5, name: "Вышка №3", x: 2730.1243, y: -2393.7451, z: 29.6514 },
  { id: 6, name: "Вышка №4", x: 2726.9043, y: -2493.1953, z: 29.6514 },
  { id: 7, name: "Вышка №5", x: 2734.9836, y: -2557.6306, z: 29.6514 },
  { id: 8, name: "Лодочная", x: 2765.4998, y: -2563.3206, z: 13.6328 },
  { id: 9, name: "Наблюдательный пункт", x: 2772.8916, y: -2447.1096, z: 13.6373 },
];

const labels = new Map<number, TextLabel>();
const dutyByPost = new Map<number, Duty>();
const postBySlot = new Map<number, number>();
/** Слот стоит в радиусе пикапа и может заступить. */
const nearPost = new Map<number, number>();

let started = false;
let lastLabelAt = 0;

export function bindArmyPosts(): void {
  if (started) {
    return;
  }
  started = true;

  for (const post of POSTS) {
    new Pickup(PICKUP_MODEL, PICKUP_TYPE, post.x, post.y, post.z, STREET_WORLD);
    labels.set(
      post.id,
      new TextLabel(
        labelText(post, null),
        Color.tryOk,
        post.x,
        post.y,
        post.z + LABEL_HEIGHT,
        LABEL_DRAW_DISTANCE,
        STREET_WORLD,
        false
      )
    );
  }

  registerCommand("post", "Посты армии", (player) => {
    showPostList(player);
  });

  setInterval(tickPosts, TICK_MS);

  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_WALK) === 0) {
      return;
    }
    onAlt(player);
  });

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== ARMY_POST_LEAVE_DIALOG_ID) {
      return;
    }
    if (Number(response) === 0) {
      return;
    }
    confirmLeave(player);
  });

  omp.on("playerDeath", (player) => {
    releaseHolder(player);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      nearPost.delete(slotId);
    }
    releaseHolder(player);
  });
}

function showPostList(player: Player): void {
  if (!isArmy(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  const lines = POSTS.map((post) => {
    const duty = dutyByPost.get(post.id);
    const who = duty ? duty.labelName : "свободен";
    return `${post.name} — ${who}`;
  });

  try {
    Dialog.show(
      player,
      ARMY_POST_LIST_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Посты армии",
      lines.join("\n"),
      "Закрыть",
      "Ок"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть список постов.");
  }
}

function onAlt(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const ownPostId = postBySlot.get(slotId);
  const ownDuty = ownPostId !== undefined ? dutyByPost.get(ownPostId) : undefined;
  const account = getAccount(player);
  if (
    ownDuty &&
    account &&
    ownDuty.slotId === slotId &&
    ownDuty.userId === account.id
  ) {
    const post = postById(ownPostId as number);
    if (post && distanceTo(player, post) <= LEAVE_RADIUS) {
      askLeave(player, post);
    }
    return;
  }

  if (ownPostId !== undefined) {
    postBySlot.delete(slotId);
  }

  const postId = nearPost.get(slotId);
  if (postId === undefined) {
    return;
  }

  const post = postById(postId);
  if (!post) {
    return;
  }

  if (!isArmy(player)) {
    player.sendClientMessage(Color.error, DENY);
    return;
  }

  if (!account || account.jailSeconds > 0 || account.hospitalized) {
    player.sendClientMessage(Color.error, "Сейчас заступить на пост нельзя.");
    return;
  }

  if (isCuffed(player)) {
    player.sendClientMessage(Color.error, "В наручниках на пост не заступить.");
    return;
  }

  const taken = dutyByPost.get(post.id);
  if (taken) {
    player.sendClientMessage(Color.error, `Пост занят: ${taken.labelName}.`);
    return;
  }

  takePost(player, post);
}

function askLeave(player: Player, post: PostDef): void {
  try {
    Dialog.show(
      player,
      ARMY_POST_LEAVE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      post.name,
      `Покинуть пост ${post.name}?`,
      "Да",
      "Нет"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
  }
}

function takePost(player: Player, post: PostDef): void {
  const slotId = playerId(player);
  const account = getAccount(player);
  if (slotId === null || !account) {
    return;
  }

  const duty: Duty = {
    slotId,
    userId: account.id,
    labelName: playerChatName(player),
    since: Date.now(),
    paidTicks: 0,
  };
  dutyByPost.set(post.id, duty);
  postBySlot.set(slotId, post.id);
  paint(post);
  player.sendClientMessage(
    Color.info,
    `Вы заступили на пост ${post.name}. Не отходите дальше ${LEAVE_RADIUS} метров.`
  );
}

function confirmLeave(player: Player): void {
  const slotId = playerId(player);
  const account = getAccount(player);
  if (slotId === null || !account) {
    return;
  }

  const postId = postBySlot.get(slotId);
  const duty = postId !== undefined ? dutyByPost.get(postId) : undefined;
  if (!duty || duty.slotId !== slotId || duty.userId !== account.id) {
    return;
  }

  const post = postById(postId as number);
  freePost(postId as number);
  if (post && isPlayerActive(player)) {
    player.sendClientMessage(Color.info, `Вы покинули пост ${post.name}.`);
  }
}

/** Смерть и выход: снять пост этого игрока, чужой пост не трогать. */
function releaseHolder(player: Player): void {
  const slotId = playerId(player);
  const account = getAccount(player);
  for (const [postId, duty] of [...dutyByPost]) {
    const sameSlot = slotId !== null && duty.slotId === slotId;
    const sameUser = account !== null && duty.userId === account.id;
    if (sameSlot || sameUser) {
      freePost(postId);
    }
  }
}

function freePost(postId: number): void {
  const duty = dutyByPost.get(postId);
  dutyByPost.delete(postId);
  if (duty && postBySlot.get(duty.slotId) === postId) {
    postBySlot.delete(duty.slotId);
  }
  const post = postById(postId);
  if (post) {
    paint(post);
  }
}

function tickPosts(): void {
  const now = Date.now();
  for (const [postId, duty] of [...dutyByPost]) {
    const holder = omp.players.at(duty.slotId);
    const account = holder && isPlayerActive(holder) ? getAccount(holder) : null;
    if (!holder || !isPlayerActive(holder) || !account || account.id !== duty.userId) {
      freePost(postId);
      continue;
    }

    const post = postById(postId);
    if (!post || !canKeepDuty(holder, duty)) {
      const name = post?.name ?? "пост";
      freePost(postId);
      const text = post ? dutyLeaveText(holder, duty, name) : "";
      if (text) {
        holder.sendClientMessage(Color.info, text);
      }
      continue;
    }

    if (distanceTo(holder, post) > LEAVE_RADIUS) {
      freePost(postId);
      holder.sendClientMessage(Color.info, `Вы отошли от поста ${post.name}.`);
      continue;
    }

    payDuty(holder, post, duty, now);
  }

  omp.players.forEach((player) => {
    const slotId = playerId(player);
    if (slotId === null || !isPlayerActive(player) || !isAuthenticated(player)) {
      if (slotId !== null) {
        nearPost.delete(slotId);
      }
      return;
    }

    const postId = nearestStandPost(player);
    if (postId === null) {
      nearPost.delete(slotId);
    } else {
      nearPost.set(slotId, postId);
    }
  });

  if (now - lastLabelAt >= LABEL_MS) {
    lastLabelAt = now;
    for (const post of POSTS) {
      if (dutyByPost.has(post.id)) {
        paint(post);
      }
    }
  }
}

function payDuty(player: Player, post: PostDef, duty: Duty, now: number): void {
  const ticks = Math.floor((now - duty.since) / PAY_MS);
  if (ticks <= duty.paidTicks) {
    return;
  }

  const due = ticks - duty.paidTicks;
  const account = getAccount(player);
  if (!account || account.id !== duty.userId) {
    return;
  }

  const payout = due * PAY_AMOUNT;
  if (account.money > MAX_MONEY - payout) {
    duty.paidTicks = ticks;
    player.sendClientMessage(Color.error, "Слишком много наличных, выплата за пост не начислена.");
    return;
  }

  duty.paidTicks = ticks;

  const money = account.money + payout;
  patchAccount(player, { money });
  const live = getAccount(player);
  if (live && live.id === duty.userId) {
    applyWallet(player, live);
    queueSave(player);
  }

  player.sendClientMessage(
    Color.info,
    `Пост ${post.name}: ${formatMoney(payout)}.`
  );
}

function dutyLeaveText(player: Player, duty: Duty, name: string): string {
  const account = getAccount(player);
  if (!account || account.id !== duty.userId) {
    return "";
  }
  if (account.jailSeconds > 0) {
    return `Вас посадили, пост ${name} оставлен.`;
  }
  if (account.hospitalized) {
    return `Вы в больнице, пост ${name} оставлен.`;
  }
  if (!isArmy(player)) {
    return `Вы больше не в Армии и сняты с поста ${name}.`;
  }
  if (isCuffed(player)) {
    return `В наручниках пост ${name} оставлен.`;
  }
  return `Вы сняты с поста ${name}.`;
}

function canKeepDuty(player: Player, duty: Duty): boolean {
  const account = getAccount(player);
  if (!account || account.id !== duty.userId || !isArmy(player) || isCuffed(player)) {
    return false;
  }

  if (account.hospitalized || account.jailSeconds > 0) {
    return false;
  }

  try {
    const state = player.getState();
    if (state === PLAYER_STATE_WASTED || state === PLAYER_STATE_SPECTATING) {
      return false;
    }
    if (player.getInterior() !== 0 || player.getVirtualWorld() !== STREET_WORLD) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function nearestStandPost(player: Player): number | null {
  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      return null;
    }
    if (player.getInterior() !== 0 || player.getVirtualWorld() !== STREET_WORLD) {
      return null;
    }
  } catch {
    return null;
  }

  let best: number | null = null;
  let bestDist = STAND_RADIUS;
  for (const post of POSTS) {
    const dist = distanceTo(player, post);
    if (dist <= bestDist) {
      best = post.id;
      bestDist = dist;
    }
  }
  return best;
}

function distanceTo(player: Player, post: PostDef): number {
  try {
    const pos = player.getPos();
    const dx = pos.x - post.x;
    const dy = pos.y - post.y;
    const dz = pos.z - post.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isArmy(player: Player): boolean {
  const account = getAccount(player);
  if (!account || !isAuthenticated(player)) {
    return false;
  }
  return getMembership(account)?.org.id === ORG_ARMY_ID;
}

function postById(id: number): PostDef | null {
  return POSTS.find((post) => post.id === id) ?? null;
}

function labelText(post: PostDef, duty: Duty | null): string {
  if (!duty) {
    return `${post.name}\nСвободен`;
  }
  const stood = formatDuty(Date.now() - duty.since);
  return `${post.name}\n${duty.labelName}\nна посту ${stood}`;
}

function formatDuty(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  }
  return `${seconds} сек`;
}

function paint(post: PostDef): void {
  const label = labels.get(post.id);
  if (!label) {
    return;
  }
  const duty = dutyByPost.get(post.id) ?? null;
  try {
    label.updateText(duty ? Color.info : Color.tryOk, labelText(post, duty));
  } catch {
    // Лейбл уже уничтожен.
  }
}
