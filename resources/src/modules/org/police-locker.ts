import { Dialog, omp, Pickup, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { grantArmour } from "../anticheat/trust";
import { getAccount, isAuthenticated } from "../auth/session";
import { getWarehouse } from "../warehouse";
import { AMMUNATION_INTERIOR } from "./ammunation-doors";
import {
  issueLockerWeapon,
  lockerAmmoCost,
  lockerItemLabel,
} from "./locker-ammo";
import { getMembership } from "./membership";
import { ORG_POLICE_ID } from "./police";

export const POLICE_LOCKER_DIALOG_ID = 22;

const PICKUP_MODEL = 19134;
const PICKUP_TYPE = 1;
const PLAYER_STATE_ONFOOT = 1;
const DIALOG_STYLE_LIST = 2;
const PICKUP_RADIUS = 1.5;
const TICK_MS = 200;
const AMMO_LABEL_HEIGHT = 1.4;
const AMMO_LABEL_DRAW_DISTANCE = 12;
const SWAT_SKIN = 285;
const MAX_ARMOR = 100;
const DENY = "Вы не состоите в областной полиции.";

/** Аммунация областной полиции (интерьер 6, VW = org_id). */
const POINT = {
  x: 312.4084,
  y: -165.5791,
  z: 999.601,
} as const;

type LockerItem = {
  label: string;
  kind: "armor" | "weapon" | "skin";
  id: number;
  ammo?: number;
};

const ITEMS: readonly LockerItem[] = [
  { label: "Бронежилет", kind: "armor", id: 0 },
  { label: "Дубинка", kind: "weapon", id: 3, ammo: 1 },
  { label: "Desert Eagle", kind: "weapon", id: 24, ammo: 50 },
  { label: "Shotgun", kind: "weapon", id: 25, ammo: 40 },
  { label: "MP5", kind: "weapon", id: 29, ammo: 120 },
  { label: "M4", kind: "weapon", id: 31, ammo: 150 },
  { label: "Спец. форма SWAT", kind: "skin", id: SWAT_SKIN },
];

const inside = new Set<number>();
let ammoStockLabel: TextLabel | null = null;

function ammoStockLabelText(): string {
  const ammo = getWarehouse(ORG_POLICE_ID)?.ammo ?? 0;
  return `Патроны: ${ammo}`;
}

export function refreshPoliceAmmoStockLabel(): void {
  if (!ammoStockLabel) {
    return;
  }

  try {
    ammoStockLabel.updateText(Color.info, ammoStockLabelText());
  } catch {
    // Лейбл уже уничтожен.
  }
}

export function bindPoliceLocker(): void {
  new Pickup(PICKUP_MODEL, PICKUP_TYPE, POINT.x, POINT.y, POINT.z, ORG_POLICE_ID);
  ammoStockLabel = new TextLabel(
    ammoStockLabelText(),
    Color.info,
    POINT.x,
    POINT.y,
    POINT.z + AMMO_LABEL_HEIGHT,
    AMMO_LABEL_DRAW_DISTANCE,
    ORG_POLICE_ID,
    false
  );

  setInterval(tickLocker, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== POLICE_LOCKER_DIALOG_ID) {
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

      if (
        player.getVirtualWorld() !== ORG_POLICE_ID ||
        player.getInterior() !== AMMUNATION_INTERIOR
      ) {
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
  if (!membership || membership.org.id !== ORG_POLICE_ID) {
    if (tellDeny) {
      tell(player, Color.error, DENY);
    }
    return false;
  }

  return true;
}

function showLocker(player: Player): void {
  const stock = getWarehouse(ORG_POLICE_ID)?.ammo ?? 0;
  try {
    Dialog.show(
      player,
      POLICE_LOCKER_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Оружейная | Патроны: ${stock}`,
      ITEMS.map(
        (item, index) => `${index + 1}. ${lockerItemLabel(item.label, item)}`
      ).join("\n"),
      "Взять",
      "Закрыть"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть склад.");
  }
}

function pickItem(listItem: number, inputText: string): LockerItem | null {
  const raw = inputText.replace(/^\d+\.\s*/, "").trim().toLowerCase();
  const byLabel = ITEMS.find((item) => {
    const full = lockerItemLabel(item.label, item).toLowerCase();
    return full === raw || item.label.toLowerCase() === raw;
  });
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

    if (item.kind === "skin") {
      player.setSkin(item.id);
      tell(player, Color.info, "Вы надели спец. форму SWAT. После смерти или выхода она сбросится.");
      return;
    }

    const cost = lockerAmmoCost(item);
    const error = issueLockerWeapon(
      player,
      ORG_POLICE_ID,
      item.id,
      item.ammo ?? 1,
      cost,
      refreshPoliceAmmoStockLabel
    );
    if (error) {
      tell(player, Color.error, error);
      return;
    }

    if (cost > 0) {
      const left = getWarehouse(ORG_POLICE_ID)?.ammo ?? 0;
      tell(
        player,
        Color.info,
        `Вы взяли: ${item.label} (-${cost} патр., склад: ${left}).`
      );
      return;
    }

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
