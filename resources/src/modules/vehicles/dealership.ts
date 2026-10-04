import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import { findOwnedHouse } from "../houses/repository";
import {
  listBusinesses,
  setBusinessBalance,
  type BusinessRecord,
} from "../businesses/repository";
import { BusinessType } from "../businesses/types";
import { STREET_WORLD } from "../spawn/point";
import { DEFAULT_BUY_COLOR, purchasePlayerVehicle } from "./player-vehicles";
import { spawnPersonalVehicle } from "./personal";

export const DEALERSHIP_LIST_DIALOG_ID = 84;
export const DEALERSHIP_CONFIRM_DIALOG_ID = 85;

const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const PLAYER_STATE_ONFOOT = 1;
const DIALOG_STYLE_TABLIST_HEADERS = 5;
const DIALOG_STYLE_MSGBOX = 0;

type CatalogItem = {
  modelId: number;
  name: string;
  price: number;
};

type PendingList = {
  businessId: number;
  typeId: number;
  items: CatalogItem[];
};

type PendingBuy = {
  businessId: number;
  item: CatalogItem;
};

const ELITE_CATALOG: readonly CatalogItem[] = [
  { modelId: 402, name: "Buffalo", price: 95_000 },
  { modelId: 411, name: "Infernus", price: 350_000 },
];

const ECONOMY_CATALOG: readonly CatalogItem[] = [
  { modelId: 400, name: "Landstalker", price: 28_000 },
  { modelId: 401, name: "Bravura", price: 18_000 },
];

const MOTO_CATALOG: readonly CatalogItem[] = [
  { modelId: 461, name: "PCJ-600", price: 35_000 },
  { modelId: 462, name: "Faggio", price: 5_000 },
  { modelId: 463, name: "Freeway", price: 22_000 },
  { modelId: 468, name: "Sanchez", price: 28_000 },
  { modelId: 471, name: "Quad", price: 30_000 },
  { modelId: 521, name: "FCR-900", price: 55_000 },
  { modelId: 522, name: "NRG-500", price: 120_000 },
  { modelId: 581, name: "BF-400", price: 32_000 },
  { modelId: 586, name: "Wayfarer", price: 15_000 },
];

const DEALERSHIP_TYPES = new Set<number>([
  BusinessType.CAR_ELITE,
  BusinessType.CAR_ECONOMY,
  BusinessType.MOTO,
]);

const standingOn = new Map<number, number>();
const pendingList = new Map<number, PendingList>();
const pendingBuy = new Map<number, PendingBuy>();
const buying = new Set<number>();

export function startDealerships(): void {
  setInterval(tickDealerships, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    const id = Number(dialogId);
    if (id !== DEALERSHIP_LIST_DIALOG_ID && id !== DEALERSHIP_CONFIRM_DIALOG_ID) {
      return;
    }

    if (id === DEALERSHIP_LIST_DIALOG_ID) {
      handleListResponse(player, Number(response) !== 0, Number(listItem));
      return;
    }

    void handleConfirmResponse(player, Number(response) !== 0);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      standingOn.delete(slotId);
      pendingList.delete(slotId);
      pendingBuy.delete(slotId);
    }
    const account = getAccount(player);
    if (account) {
      buying.delete(account.id);
    }
  });

  const count = listBusinesses().filter((b) => DEALERSHIP_TYPES.has(b.typeId)).length;
  omp.log(`[${SERVER_TAG}] автосалоны: точек ${count}`);
}

function catalogForType(typeId: number): readonly CatalogItem[] | null {
  if (typeId === BusinessType.CAR_ELITE) {
    return ELITE_CATALOG;
  }
  if (typeId === BusinessType.CAR_ECONOMY) {
    return ECONOMY_CATALOG;
  }
  if (typeId === BusinessType.MOTO) {
    return MOTO_CATALOG;
  }
  return null;
}

function licenseForType(typeId: number): "car" | "moto" {
  return typeId === BusinessType.MOTO ? "moto" : "car";
}

function shopTitle(typeId: number): string {
  if (typeId === BusinessType.CAR_ELITE) {
    return "Элитный автосалон";
  }
  if (typeId === BusinessType.CAR_ECONOMY) {
    return "Автосалон эконом";
  }
  return "Моторынок";
}

function tickDealerships(): void {
  const shops = listBusinesses().filter((b) => DEALERSHIP_TYPES.has(b.typeId));
  if (shops.length === 0) {
    return;
  }

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(slotId);
        return;
      }
      if (player.getVirtualWorld() !== STREET_WORLD || player.getInterior() !== 0) {
        standingOn.delete(slotId);
        return;
      }

      const pos = player.getPos();
      const near = findNearestShop(shops, pos.x, pos.y, pos.z);
      if (!near) {
        standingOn.delete(slotId);
        return;
      }

      if (standingOn.get(slotId) === near.id) {
        return;
      }

      standingOn.set(slotId, near.id);
      openDealership(player, near);
    } catch {
      standingOn.delete(slotId);
    }
  });
}

function findNearestShop(
  shops: readonly BusinessRecord[],
  x: number,
  y: number,
  z: number
): BusinessRecord | null {
  let best: BusinessRecord | null = null;
  let bestDist = PICKUP_RADIUS;
  for (const shop of shops) {
    const dist = Math.hypot(x - shop.entranceX, y - shop.entranceY, z - shop.entranceZ);
    if (dist <= bestDist) {
      bestDist = dist;
      best = shop;
    }
  }
  return best;
}

function openDealership(player: Player, shop: BusinessRecord): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  const need = licenseForType(shop.typeId);
  if (!account.licenses[need]) {
    player.sendClientMessage(
      Color.error,
      need === "moto"
        ? "У вас нет лицензии на мотоциклы."
        : "У вас нет лицензии на автомобили."
    );
    return;
  }

  if (!findOwnedHouse(account.id)) {
    player.sendClientMessage(
      Color.error,
      "Чтобы купить транспорт, нужен дом — машина появится на парковке у дома."
    );
    return;
  }

  const catalog = catalogForType(shop.typeId);
  if (!catalog || catalog.length === 0) {
    return;
  }

  pendingList.set(slotId, {
    businessId: shop.id,
    typeId: shop.typeId,
    items: [...catalog],
  });
  pendingBuy.delete(slotId);

  const lines = [
    "Модель\tЦена",
    ...catalog.map((item) => `${item.name}\t${formatMoney(item.price)}`),
  ];

  try {
    Dialog.show(
      player,
      DEALERSHIP_LIST_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      shopTitle(shop.typeId),
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    pendingList.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть каталог.");
  }
}

function handleListResponse(player: Player, ok: boolean, listItem: number): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const pending = pendingList.get(slotId);
  pendingList.delete(slotId);
  if (!pending || !ok) {
    return;
  }

  const item = pending.items[listItem];
  if (!item) {
    return;
  }

  pendingBuy.set(slotId, { businessId: pending.businessId, item });

  try {
    Dialog.show(
      player,
      DEALERSHIP_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Покупка транспорта",
      [
        `Купить ${item.name}?`,
        "",
        `Цена: ${formatMoney(item.price)}`,
        "Оплата наличными.",
        "Цвет: белый.",
        "Машина появится на парковке у вашего дома.",
      ].join("\n"),
      "Купить",
      "Отмена"
    );
  } catch {
    pendingBuy.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
  }
}

async function handleConfirmResponse(player: Player, ok: boolean): Promise<void> {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  const pending = pendingBuy.get(slotId);
  pendingBuy.delete(slotId);
  if (!pending || !ok) {
    return;
  }

  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  const shop = listBusinesses().find((b) => b.id === pending.businessId);
  if (!shop || !DEALERSHIP_TYPES.has(shop.typeId)) {
    player.sendClientMessage(Color.error, "Автосалон недоступен.");
    return;
  }

  const need = licenseForType(shop.typeId);
  if (!account.licenses[need]) {
    player.sendClientMessage(
      Color.error,
      need === "moto"
        ? "У вас нет лицензии на мотоциклы."
        : "У вас нет лицензии на автомобили."
    );
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    player.sendClientMessage(
      Color.error,
      "Чтобы купить транспорт, нужен дом — машина появится на парковке у дома."
    );
    return;
  }

  if (Math.max(0, Math.floor(account.money)) < pending.item.price) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(pending.item.price)}.`
    );
    return;
  }

  if (buying.has(account.id)) {
    return;
  }

  buying.add(account.id);
  let result;
  try {
    result = await purchasePlayerVehicle({
      ownerId: account.id,
      businessId: pending.businessId,
      modelId: pending.item.modelId,
      price: pending.item.price,
      color1: DEFAULT_BUY_COLOR,
      color2: DEFAULT_BUY_COLOR,
    });
  } catch (error: unknown) {
    buying.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] покупка ТС ${pending.item.modelId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }
  buying.delete(account.id);

  if (!result.ok) {
    if (result.reason === "owned") {
      player.sendClientMessage(
        Color.error,
        "У вас уже есть транспорт. Одновременно можно владеть только одной машиной."
      );
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(
        Color.error,
        `Недостаточно наличных. Нужно ${formatMoney(pending.item.price)}.`
      );
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  setBusinessBalance(pending.businessId, result.balance);

  if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
    spawnPersonalVehicle(
      result.vehicle,
      house.vehicleX,
      house.vehicleY,
      house.vehicleZ,
      house.vehicleAngle
    );
    return;
  }

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  const spawned = spawnPersonalVehicle(
    result.vehicle,
    house.vehicleX,
    house.vehicleY,
    house.vehicleZ,
    house.vehicleAngle
  );

  player.sendClientMessage(
    Color.tryOk,
    `Вы купили ${pending.item.name} за ${formatMoney(result.amount)}.`
  );
  if (spawned) {
    player.sendClientMessage(Color.info, "Транспорт стоит на парковке у вашего дома.");
  } else {
    player.sendClientMessage(
      Color.error,
      "Покупка сохранена, но не удалось поставить машину у дома. Обратитесь к администрации."
    );
  }
}
