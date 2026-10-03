import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { CHAT_RADIUS, sendNearby } from "../../shared/nearby";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { grantWeapon } from "../anticheat/trust";
import { saveUserInventory } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { getMembership } from "../org";
import { isJailed } from "../prison/sentence";
import { STREET_WORLD } from "../spawn/point";
import { findTurfAtPlayer, isGangOrgId } from "../zones/turf";
import { registerCommand } from "./registry";

const USAGE_LINES = [
  "Использование: /makegun [1-7] [патроны 1-500]",
  "1 Deagle, 2 AK-47, 3 M4, 4 Shotgun, 5 SD Pistol, 6 MP5, 7 Sniper",
] as const;

const PLAYER_STATE_ONFOOT = 1;
const ANIM_SYNC_ALL = 1;
const CRAFT_MS = 2500;
const MIN_AMMO = 1;
const MAX_AMMO = 500;

type GunRecipe = {
  label: string;
  weaponId: number;
  /** Металл за 1 патрон в стволе. */
  metalPerRound: number;
};

/** ID в команде → рецепт. Патроны игрока списываются 1:1 с выданными. */
const RECIPES: ReadonlyMap<number, GunRecipe> = new Map([
  [1, { label: "Desert Eagle", weaponId: 24, metalPerRound: 2 }],
  [2, { label: "AK-47", weaponId: 30, metalPerRound: 3 }],
  [3, { label: "M4", weaponId: 31, metalPerRound: 3 }],
  [4, { label: "Shotgun", weaponId: 25, metalPerRound: 4 }],
  [5, { label: "SD Pistol", weaponId: 23, metalPerRound: 2 }],
  [6, { label: "MP5", weaponId: 29, metalPerRound: 2 }],
  [7, { label: "Sniper Rifle", weaponId: 34, metalPerRound: 10 }],
]);

/** Слот → id текущей сборки (защита от гонки смерть→новый /makegun). */
const craftSession = new Map<number, number>();
let nextCraftSession = 1;

registerCommand(
  "makegun",
  "Собрать оружие на территории банды (патроны + металл)",
  (player, args) => {
    void handleMakeGun(player, args);
  }
);

async function handleMakeGun(player: Player, args: string): Promise<void> {
  if (!isAuthenticated(player)) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  const slot = playerId(player);
  const account = getAccount(player);
  if (slot === null || !account) {
    return;
  }

  if (craftSession.has(slot)) {
    player.sendClientMessage(Color.error, "Вы уже собираете оружие.");
    return;
  }

  if (account.hospitalized) {
    player.sendClientMessage(
      Color.error,
      "Сначала пройдите лечение в больнице."
    );
    return;
  }

  if (isJailed(player)) {
    player.sendClientMessage(Color.error, "В тюрьме нельзя собирать оружие.");
    return;
  }

  const membership = getMembership(account);
  if (!membership || !isGangOrgId(membership.org.id)) {
    player.sendClientMessage(Color.error, "Команда доступна только бандам.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Собирать оружие можно только пешком.");
      return;
    }

    if (
      player.getVirtualWorld() !== STREET_WORLD ||
      player.getInterior() !== 0
    ) {
      player.sendClientMessage(
        Color.error,
        "Собирать оружие можно только на улице."
      );
      return;
    }
  } catch {
    return;
  }

  const turf = findTurfAtPlayer(player);
  if (!turf || turf.orgId !== membership.org.id) {
    player.sendClientMessage(
      Color.error,
      "Собирать оружие можно только на территории своей банды."
    );
    return;
  }

  const parsed = parseArgs(args);
  if (!parsed) {
    sendUsage(player);
    return;
  }

  const recipe = RECIPES.get(parsed.gunId);
  if (!recipe) {
    sendUsage(player);
    return;
  }

  const ammoCost = parsed.ammo;
  const metalCost = ammoCost * recipe.metalPerRound;

  if (account.ammo < ammoCost) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно патронов. Нужно: ${ammoCost} (есть ${account.ammo}).`
    );
    return;
  }

  if (account.metal < metalCost) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно металла. Нужно: ${metalCost} (есть ${account.metal}).`
    );
    return;
  }

  const session = nextCraftSession++;
  craftSession.set(slot, session);
  setControllable(player, false);
  playCraftAnim(player);
  player.sendClientMessage(
    Color.info,
    `Сборка: ${recipe.label} (${ammoCost} патр.)…`
  );

  await sleep(CRAFT_MS);

  if (craftSession.get(slot) !== session) {
    return;
  }

  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    clearCraft(slot);
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== account.id) {
    finishCraft(player, slot, session);
    return;
  }

  if (live.hospitalized || isJailed(player)) {
    finishCraft(player, slot, session);
    player.sendClientMessage(Color.error, "Сборка отменена.");
    return;
  }

  const liveMembership = getMembership(live);
  if (
    !liveMembership ||
    !isGangOrgId(liveMembership.org.id) ||
    liveMembership.org.id !== membership.org.id
  ) {
    finishCraft(player, slot, session);
    player.sendClientMessage(Color.error, "Сборка отменена.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      finishCraft(player, slot, session);
      player.sendClientMessage(Color.error, "Сборка отменена.");
      return;
    }
  } catch {
    finishCraft(player, slot, session);
    return;
  }

  const liveTurf = findTurfAtPlayer(player);
  if (!liveTurf || liveTurf.orgId !== membership.org.id) {
    finishCraft(player, slot, session);
    player.sendClientMessage(
      Color.error,
      "Сборка отменена: вы покинули территорию."
    );
    return;
  }

  if (live.ammo < ammoCost || live.metal < metalCost) {
    finishCraft(player, slot, session);
    player.sendClientMessage(Color.error, "Недостаточно материалов для сборки.");
    return;
  }

  const prevAmmo = live.ammo;
  const prevMetal = live.metal;
  const prevDrugs = live.drugs;
  const nextAmmo = prevAmmo - ammoCost;
  const nextMetal = prevMetal - metalCost;
  patchAccount(player, { ammo: nextAmmo, metal: nextMetal });
  void saveUserInventory(live.id, prevDrugs, nextAmmo, nextMetal).catch(() => {
    // Кэш уже обновлён.
  });

  if (!grantWeapon(player, recipe.weaponId, ammoCost)) {
    patchAccount(player, { ammo: prevAmmo, metal: prevMetal });
    void saveUserInventory(live.id, prevDrugs, prevAmmo, prevMetal).catch(
      () => {}
    );
    finishCraft(player, slot, session);
    player.sendClientMessage(Color.error, "Не удалось выдать оружие.");
    return;
  }

  finishCraft(player, slot, session);
  player.sendClientMessage(
    Color.info,
    `Вы собрали ${recipe.label} (${ammoCost} патр.). −${ammoCost} патр., −${metalCost} металла.`
  );
  sendNearby(
    player,
    CHAT_RADIUS,
    Color.action,
    `* ${playerName(player)} достал детали и собрал оружие.`
  );
}

function parseArgs(args: string): { gunId: number; ammo: number } | null {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  if (!/^\d+$/.test(parts[0]!) || !/^\d+$/.test(parts[1]!)) {
    return null;
  }

  const gunId = Number(parts[0]);
  const ammo = Number(parts[1]);
  if (!Number.isInteger(gunId) || !RECIPES.has(gunId)) {
    return null;
  }

  if (!Number.isInteger(ammo) || ammo < MIN_AMMO || ammo > MAX_AMMO) {
    return null;
  }

  return { gunId, ammo };
}

function sendUsage(player: Player): void {
  for (const line of USAGE_LINES) {
    player.sendClientMessage(Color.error, line);
  }
}

function finishCraft(player: Player, slot: number, session: number): void {
  if (craftSession.get(slot) !== session) {
    return;
  }

  clearCraft(slot);
  setControllable(player, true);
  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Уже вышел.
  }
}

function clearCraft(slot: number): void {
  craftSession.delete(slot);
}

function playCraftAnim(player: Player): void {
  try {
    player.applyAnimation(
      "BOMBER",
      "BOM_Plant",
      4.0,
      false,
      false,
      false,
      false,
      0,
      ANIM_SYNC_ALL
    );
  } catch {
    // Анимация опциональна.
  }
}

function setControllable(player: Player, enabled: boolean): void {
  try {
    player.toggleControllable(enabled);
  } catch {
    // Слот пуст.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

omp.on("playerDisconnect", (player) => {
  const slot = playerId(player);
  if (slot !== null) {
    clearCraft(slot);
  }
});

omp.on("playerDeath", (player) => {
  const slot = playerId(player);
  const session = slot !== null ? craftSession.get(slot) : undefined;
  if (slot === null || session === undefined) {
    return;
  }

  finishCraft(player, slot, session);
});
