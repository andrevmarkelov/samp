import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { grantArmour, grantWeapon } from "../anticheat/trust";
import { getAccount, isAuthenticated } from "../auth/session";
import { LAW_ORG_IDS } from "../org/lspd";
import { getMembership } from "../org/membership";
import { PRISON_WORLD } from "../spawn/point";

export const PRISON_LOCKER_DIALOG_ID = 25;

const PICKUP_MODEL = 19134;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const DIALOG_STYLE_LIST = 2;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const LABEL_HEIGHT = 0.85;
const LABEL_DRAW_DISTANCE = 12;
const MAX_ARMOR = 100;
const DENY = "Открыть могут сотрудники LSPD, областной полиции и FBI.";

const POINT = {
  x: -100.0232,
  y: 2438.4526,
  z: 1186.3364,
} as const;

type LockerItem = {
  label: string;
  kind: "armor" | "weapon";
  id: number;
  ammo?: number;
};

const ITEMS: readonly LockerItem[] = [
  { label: "Бронежилет", kind: "armor", id: 0 },
  { label: "Дубинка", kind: "weapon", id: 3, ammo: 1 },
];

const inside = new Set<number>();

export function bindPrisonLocker(): void {
  new Pickup(PICKUP_MODEL, PICKUP_TYPE, POINT.x, POINT.y, POINT.z, PRISON_WORLD);
  new TextLabel(
    "Оружейная\nСклад тюрьмы",
    Color.info,
    POINT.x,
    POINT.y,
    POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    PRISON_WORLD,
    false
  );

  setInterval(tickLocker, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== PRISON_LOCKER_DIALOG_ID) {
      return;
    }

    if (Number(response) === 0) {
      return;
    }

    const item = pickItem(Number(listItem), String(inputText ?? ""));
    if (!item || !canUseLocker(player)) {
      return;
    }

    giveItem(player, item);
    showLocker(player);
  });

  omp.on("playerConnect", (player) => {
    clearPlayer(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearPlayer(player);
  });
}

function tickLocker(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        inside.delete(id);
        return;
      }

      if (player.getVirtualWorld() !== PRISON_WORLD || player.getInterior() !== 0) {
        inside.delete(id);
        return;
      }

      const pos = player.getPos();
      if (distance3d(pos.x, pos.y, pos.z, POINT.x, POINT.y, POINT.z) > PICKUP_RADIUS) {
        inside.delete(id);
        return;
      }

      if (inside.has(id)) {
        return;
      }

      inside.add(id);
      tryOpen(player);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}

function tryOpen(player: Player): void {
  if (!canUseLocker(player, true)) {
    return;
  }

  showLocker(player);
}

function canUseLocker(player: Player, tellDeny = false): boolean {
  const account = getAccount(player);
  if (!account) {
    return false;
  }

  if (account.hospitalized) {
    if (tellDeny) {
      tell(player, Color.error, "Сначала пройдите лечение в больнице.");
    }
    return false;
  }

  const membership = getMembership(account);
  const orgId = membership?.org.id;
  if (orgId === undefined || !(LAW_ORG_IDS as readonly number[]).includes(orgId)) {
    if (tellDeny) {
      tell(player, Color.error, DENY);
    }
    return false;
  }

  return true;
}

function showLocker(player: Player): void {
  try {
    Dialog.show(
      player,
      PRISON_LOCKER_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Оружейная",
      ITEMS.map((item, index) => `${index + 1}. ${item.label}`).join("\n"),
      "Взять",
      "Закрыть"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть склад.");
  }
}

function pickItem(listItem: number, inputText: string): LockerItem | null {
  const raw = inputText.replace(/^\d+\.\s*/, "").trim().toLowerCase();
  const byLabel = ITEMS.find((item) => item.label.toLowerCase() === raw);
  if (byLabel) {
    return byLabel;
  }

  return ITEMS[listItem] ?? null;
}

function giveItem(player: Player, item: LockerItem): void {
  try {
    if (item.kind === "armor") {
      grantArmour(player, MAX_ARMOR);
      tell(player, Color.info, "Вы надели бронежилет.");
      return;
    }

    grantWeapon(player, item.id, item.ammo ?? 1);
    tell(player, Color.info, `Вы взяли: ${item.label}.`);
  } catch {
    tell(player, Color.error, "Не удалось выдать снаряжение.");
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, text);
  } catch {
    // Игрок уже вышел.
  }
}

function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function clearPlayer(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    inside.delete(id);
  }
}
