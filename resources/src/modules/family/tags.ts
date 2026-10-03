import { omp, TextLabel, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { getFamily } from "./catalog";
import { getFamilyMembership } from "./membership";

/** Приглушённый серо-лавандовый — не режет глаз. */
const LABEL_COLOR = 0xa8a8c0ff;
/** Чуть выше ника. */
const LABEL_OFFSET_Z = 1.15;
/** Примерно как дистанция ника. */
const LABEL_DRAW_DISTANCE = 20;
const TICK_MS = 1000;

const labels = new Map<number, TextLabel>();

export function startFamilyTags(): void {
  omp.on("playerSpawn", (player) => {
    syncFamilyTag(player);
  });

  omp.on("playerDisconnect", (player) => {
    clearFamilyTag(player);
  });

  setInterval(tickFamilyTags, TICK_MS);
}

/** Обновить / снять лейбл семьи у игрока. */
export function syncFamilyTag(player: Player): void {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player) || !isAuthenticated(player)) {
    clearFamilyTag(player);
    return;
  }

  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    clearFamilyTag(player);
    return;
  }

  const text = membership.family.name;
  const existing = labels.get(id);

  try {
    if (existing) {
      existing.updateText(LABEL_COLOR, text);
      existing.setVirtualWorld(player.getVirtualWorld());
      return;
    }

    const pos = player.getPos();
    const label = new TextLabel(
      text,
      LABEL_COLOR,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      player.getVirtualWorld(),
      false
    );
    label.attachToPlayer(player, 0, 0, LABEL_OFFSET_Z);
    labels.set(id, label);
  } catch {
    clearFamilyTag(player);
  }
}

export function clearFamilyTag(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  clearFamilyTagById(id);
}

/** После переименования семьи — обновить лейблы всех онлайн-участников. */
export function refreshFamilyTags(familyId: number): void {
  const family = getFamily(familyId);
  if (!family) {
    return;
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player)) {
      return;
    }

    const account = getAccount(player);
    if (!account || account.familyId !== familyId) {
      return;
    }

    syncFamilyTag(player);
  });
}

function clearFamilyTagById(id: number): void {
  const label = labels.get(id);
  if (!label) {
    return;
  }

  labels.delete(id);
  try {
    label.destroy();
  } catch {
    // Уже уничтожен.
  }
}

function tickFamilyTags(): void {
  omp.players.forEach((player) => {
    const id = playerId(player);
    if (id === null || !labels.has(id)) {
      return;
    }

    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      clearFamilyTagById(id);
      return;
    }

    const account = getAccount(player);
    if (!account || !getFamilyMembership(account)) {
      clearFamilyTagById(id);
      return;
    }

    try {
      labels.get(id)?.setVirtualWorld(player.getVirtualWorld());
    } catch {
      clearFamilyTagById(id);
    }
  });
}
