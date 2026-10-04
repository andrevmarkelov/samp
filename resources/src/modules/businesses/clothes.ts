import { omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import {
  applyWallet,
  getAccount,
  isAuthenticated,
  patchAccount,
} from "../auth/session";
import {
  bindClothesSkinPicker,
  closeSkinPicker,
  cycleSkin,
  isSkinPicking,
  openSkinPicker,
  selectedSkin,
  skinPickerBusinessId,
  skinPickerMode,
} from "../auth/skin-picker";
import { isLoaderOnShift } from "../loader";
import { refreshStreamForPlayer } from "../mapping/stream";
import { isMinerOnShift } from "../miner";
import { applyOrgVisuals } from "../org/appearance";
import { isJailed } from "../prison/sentence";
import { placeAt, type SpawnPoint } from "../spawn/point";
import { asClothesSkin, clothesCatalog } from "./clothes-catalog";
import {
  getBusiness,
  listBusinesses,
  payBusinessClothesPurchase,
  setBusinessBalance,
  type BusinessRecord,
} from "./repository";
import { getInsideBusiness } from "./session";
import { isClothesType } from "./types";
import { businessVirtualWorld } from "./world";

const PICKUP_RADIUS = 1.6;
const TICK_MS = 200;
const PLAYER_STATE_ONFOOT = 1;
const BIZ_SHARE = 0.8;

const standingOn = new Map<number, number>();
const buying = new Set<number>();

export function startClothesShops(): void {
  bindClothesSkinPicker((player, action) => {
    void handleClothesPickerAction(player, action);
  });

  setInterval(tickClothesShops, TICK_MS);

  omp.on("playerDeath", (player) => {
    abortClothesTryOn(player, { restoreShop: false });
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      standingOn.delete(slotId);
    }
    const account = getAccount(player);
    if (account) {
      buying.delete(account.id);
    }
  });

  const count = listBusinesses().filter(
    (b) => isClothesType(b.typeId) && hasBuyPickup(b)
  ).length;
  omp.log(`[${SERVER_TAG}] одежда: точек примерки ${count}`);
}

function hasBuyPickup(business: BusinessRecord): boolean {
  return (
    business.buyPickupX !== null &&
    business.buyPickupY !== null &&
    business.buyPickupZ !== null &&
    business.interiorId !== null
  );
}

/** Возврат к пикапу покупки в интерьере бизнеса. */
function clothesReturnPoint(business: BusinessRecord): SpawnPoint | null {
  if (!hasBuyPickup(business) || business.interiorId === null) {
    return null;
  }

  return {
    x: business.buyPickupX as number,
    y: business.buyPickupY as number,
    z: business.buyPickupZ as number,
    angle: 0,
    interior: business.interiorId,
    world: businessVirtualWorld(business.id),
  };
}

function tickClothesShops(): void {
  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    if (isSkinPicking(player)) {
      return;
    }

    try {
      if (player.getState() !== PLAYER_STATE_ONFOOT) {
        standingOn.delete(slotId);
        return;
      }

      const pos = player.getPos();
      const shop = findClothesBuyPickupAt(
        pos.x,
        pos.y,
        pos.z,
        player.getInterior(),
        player.getVirtualWorld(),
        slotId
      );
      if (!shop) {
        standingOn.delete(slotId);
        return;
      }

      if (standingOn.get(slotId) === shop.id) {
        return;
      }

      standingOn.set(slotId, shop.id);
      beginClothesTryOn(player, shop);
    } catch {
      standingOn.delete(slotId);
    }
  });
}

function findClothesBuyPickupAt(
  x: number,
  y: number,
  z: number,
  interior: number,
  world: number,
  slotId: number
): BusinessRecord | null {
  const insideId = getInsideBusiness(slotId);
  let best: BusinessRecord | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const business of listBusinesses()) {
    if (!isClothesType(business.typeId) || !hasBuyPickup(business)) {
      continue;
    }

    if (business.interiorId !== interior) {
      continue;
    }

    if (businessVirtualWorld(business.id) !== world) {
      continue;
    }

    if (insideId !== null && insideId !== business.id) {
      continue;
    }

    const dist = Math.hypot(
      x - (business.buyPickupX as number),
      y - (business.buyPickupY as number),
      z - (business.buyPickupZ as number)
    );
    if (dist > PICKUP_RADIUS || dist >= bestDist) {
      continue;
    }

    best = business;
    bestDist = dist;
  }

  return best;
}

function beginClothesTryOn(player: Player, business: BusinessRecord): void {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const deny = clothesBuyDeny(player);
  if (deny) {
    player.sendClientMessage(Color.error, deny);
    return;
  }

  if (business.isLocked) {
    player.sendClientMessage(Color.error, "Магазин закрыт.");
    return;
  }

  if (!hasBuyPickup(business)) {
    player.sendClientMessage(Color.error, "Примерка в этом магазине недоступна.");
    return;
  }

  const gender = account.gender;
  const catalog = clothesCatalog(gender);
  if (catalog.length === 0) {
    player.sendClientMessage(Color.error, "Нет доступных скинов.");
    return;
  }

  // Та же точка/камера, что при регистрации; свой VW подставит picker.
  const skin = openSkinPicker(player, {
    gender,
    mode: "clothes",
    catalog,
    businessId: business.id,
    skinId: catalog[0]?.id ?? 0,
  });

  if (!skin) {
    standingOn.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть примерку.");
    return;
  }

  announceClothesSkin(player, skin);
}

function clothesBuyDeny(player: Player): string | null {
  const account = getAccount(player);
  if (!account) {
    return "Сначала войдите в аккаунт.";
  }

  if (isJailed(player)) {
    return "В тюрьме нельзя покупать одежду.";
  }

  if (account.hospitalized) {
    return "Сначала пройдите лечение в больнице.";
  }

  if (isMinerOnShift(player)) {
    return "Сначала закончите смену шахтёра.";
  }

  if (isLoaderOnShift(player)) {
    return "Сначала закончите смену грузчика.";
  }

  return null;
}

async function handleClothesPickerAction(
  player: Player,
  action: "prev" | "next" | "select" | "cancel"
): Promise<void> {
  if (skinPickerMode(player) !== "clothes") {
    return;
  }

  const account = getAccount(player);
  if (account && buying.has(account.id)) {
    // Покупка в полёте: не даём отменить/перелистнуть (гонка с await).
    return;
  }

  if (action === "cancel") {
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  if (action === "prev" || action === "next") {
    const skin = cycleSkin(player, action === "next" ? 1 : -1);
    if (skin) {
      announceClothesSkin(player, skin);
    }
    return;
  }

  await purchaseClothesSkin(player);
}

function announceClothesSkin(
  player: Player,
  skin: { id: number; label: string; price?: number }
): void {
  const priced = asClothesSkin(skin);
  const priceText = priced ? formatMoney(priced.price) : "?";
  player.sendClientMessage(
    Color.info,
    `Скин: ${skin.label} | ID: ${skin.id} | Цена: ${priceText}`
  );
}

async function purchaseClothesSkin(player: Player): Promise<void> {
  const account = getAccount(player);
  const businessId = skinPickerBusinessId(player);
  const picked = selectedSkin(player);
  if (!account || businessId === null || !picked) {
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  // Цена/каталог только с сервера — не доверяем объекту сессии целиком.
  const skin =
    clothesCatalog(account.gender).find((item) => item.id === picked.id) ?? null;
  if (!skin || skin.price !== asClothesSkin(picked)?.price) {
    player.sendClientMessage(Color.error, "Скин недоступен.");
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  const deny = clothesBuyDeny(player);
  if (deny) {
    player.sendClientMessage(Color.error, deny);
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  if (buying.has(account.id)) {
    player.sendClientMessage(Color.error, "Подождите завершения покупки.");
    return;
  }

  const business = getBusiness(businessId);
  if (!business || !isClothesType(business.typeId)) {
    player.sendClientMessage(Color.error, "Магазин недоступен.");
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  if (business.isLocked) {
    player.sendClientMessage(Color.error, "Магазин закрыт.");
    exitClothesTryOn(player, { restoreShop: true });
    return;
  }

  if (account.skin === skin.id) {
    player.sendClientMessage(Color.error, "У вас уже этот скин.");
    return;
  }

  if (account.money < skin.price) {
    player.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(skin.price)}.`
    );
    return;
  }

  buying.add(account.id);
  try {
    const stillInClothesPicker = (): boolean =>
      isPlayerActive(player) &&
      getAccount(player)?.id === account.id &&
      skinPickerMode(player) === "clothes" &&
      skinPickerBusinessId(player) === businessId;

    const result = await payBusinessClothesPurchase(
      businessId,
      account.id,
      skin.price,
      skin.id,
      BIZ_SHARE
    );
    if (!result.ok) {
      if (result.reason === "funds") {
        player.sendClientMessage(Color.error, "Недостаточно наличных.");
      } else {
        player.sendClientMessage(Color.error, "Не удалось купить скин.");
      }
      return;
    }

    if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
      return;
    }

    patchAccount(player, { money: result.cashLeft, skin: skin.id });
    setBusinessBalance(businessId, result.balance);
    const live = getAccount(player);
    if (live) {
      applyWallet(player, live);
    }

    player.sendClientMessage(
      Color.info,
      `Вы купили скин «${skin.label}» за ${formatMoney(skin.price)}.`
    );

    if (stillInClothesPicker()) {
      exitClothesTryOn(player, { restoreShop: true });
    } else {
      // Уже вышли (ESC) или умерли — только визуал/кошелёк, без телепорта в магазин.
      try {
        applyOrgVisuals(player);
      } catch {
        // Слот пустой.
      }
    }
  } finally {
    buying.delete(account.id);
  }
}

function abortClothesTryOn(
  player: Player,
  options: { restoreShop: boolean }
): void {
  if (skinPickerMode(player) !== "clothes") {
    return;
  }
  exitClothesTryOn(player, options);
}

function exitClothesTryOn(
  player: Player,
  options: { restoreShop: boolean }
): void {
  const businessId = skinPickerBusinessId(player);
  closeSkinPicker(player);

  try {
    player.toggleControllable(true);
    player.setCameraBehind();
  } catch {
    // Слот пустой.
  }

  const slotId = playerId(player);
  if (!options.restoreShop || businessId === null) {
    if (slotId !== null) {
      standingOn.delete(slotId);
    }
    try {
      applyOrgVisuals(player);
    } catch {
      // Слот пустой.
    }
    return;
  }

  const business = getBusiness(businessId);
  const returnPoint = business ? clothesReturnPoint(business) : null;
  if (!returnPoint) {
    if (slotId !== null) {
      standingOn.delete(slotId);
    }
    try {
      applyOrgVisuals(player);
    } catch {
      // Слот пустой.
    }
    return;
  }

  try {
    placeAt(player, returnPoint);
    refreshStreamForPlayer(player);
    applyOrgVisuals(player);
  } catch {
    // Слот пустой.
  }

  if (slotId !== null) {
    // Чтобы сразу не открыть примерку снова — ждём отхода от пикапа.
    standingOn.set(slotId, businessId);
  }
}
