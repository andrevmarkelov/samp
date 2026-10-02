import { Dialog, omp, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { findNearbyForSaleBusiness, isNearBusinessEntrance } from "./access";
import { refreshBusinessLabel } from "./markers";
import {
  findOwnedBusiness,
  getBusiness,
  purchaseBusiness,
  setBusinessOwner,
  setBusinessTaxPaidUntil,
} from "./repository";
import { currentDateLocal } from "./tax-math";

export const BUYBIZ_CONFIRM_DIALOG_ID = 70;

const MIN_BUY_LEVEL = 3;
const DIALOG_STYLE_MSGBOX = 0;
const TITLE = "{33FF33}";
const LABEL = "{FFFFFF}";
const VALUE = "{FFFFFF}";

const pendingBuy = new Map<number, number>();
const buying = new Set<number>();

export function bindBusinessPurchase(): void {
  registerCommand("buybiz", "Купить бизнес у пикапа", (player) => {
    void openBuyBusinessDialog(player);
  });

  omp.on("dialogResponse", (player, dialogId, response) => {
    if (Number(dialogId) !== BUYBIZ_CONFIRM_DIALOG_ID) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    const businessId = pendingBuy.get(slotId);
    pendingBuy.delete(slotId);

    if (Number(response) === 0 || businessId === undefined) {
      return;
    }

    void tryPurchaseBusiness(player, businessId);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      pendingBuy.delete(slotId);
    }

    const account = getAccount(player);
    if (account) {
      buying.delete(account.id);
    }
  });
}

async function openBuyBusinessDialog(player: Player): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const business = findNearbyForSaleBusiness(player);
  if (!business) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу свободного бизнеса.");
    return;
  }

  if (findOwnedBusiness(account.id)) {
    player.sendClientMessage(Color.error, "У вас уже есть бизнес.");
    return;
  }

  if (account.level < MIN_BUY_LEVEL) {
    player.sendClientMessage(Color.error, "Купить бизнес можно с 3 уровня.");
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  const cash = Math.max(0, Math.floor(account.money));
  if (cash < business.price) {
    player.sendClientMessage(Color.error, "Недостаточно наличных.");
    return;
  }

  pendingBuy.set(slotId, business.id);

  const body = [
    `${LABEL}Вы действительно хотите купить бизнес?`,
    "",
    `${LABEL}Название:\t\t${VALUE}${business.name}`,
    `${LABEL}Номер:\t\t${VALUE}${business.id}`,
    `${LABEL}Стоимость:\t\t${VALUE}${business.price}$`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      BUYBIZ_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `${TITLE}Покупка бизнеса`,
      body,
      "Купить",
      "Отмена"
    );
  } catch {
    pendingBuy.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть окно покупки.");
  }
}

async function tryPurchaseBusiness(player: Player, businessId: number): Promise<void> {
  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null || !isPlayerActive(player)) {
    return;
  }

  const business = getBusiness(businessId);
  if (!business || business.ownerId !== null) {
    player.sendClientMessage(Color.error, "Этот бизнес уже куплен.");
    return;
  }

  if (!isNearBusinessEntrance(player, businessId)) {
    player.sendClientMessage(Color.error, "Подойдите к пикапу бизнеса.");
    return;
  }

  if (findOwnedBusiness(account.id)) {
    player.sendClientMessage(Color.error, "У вас уже есть бизнес.");
    return;
  }

  if (account.level < MIN_BUY_LEVEL) {
    player.sendClientMessage(Color.error, "Купить бизнес можно с 3 уровня.");
    return;
  }

  if (!account.passport) {
    player.sendClientMessage(Color.error, "Нужен паспорт. Оформите его в мэрии.");
    return;
  }

  const cash = Math.max(0, Math.floor(account.money));
  if (cash < business.price) {
    player.sendClientMessage(Color.error, "Недостаточно наличных.");
    return;
  }

  if (buying.has(account.id)) {
    return;
  }

  buying.add(account.id);
  let result;
  try {
    result = await purchaseBusiness(businessId, account.id);
  } catch (error: unknown) {
    buying.delete(account.id);
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] покупка бизнеса ${businessId} (${account.name}): ${message}`);
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }
  buying.delete(account.id);

  if (!result.ok) {
    if (result.reason === "owned") {
      player.sendClientMessage(Color.error, "У вас уже есть бизнес.");
      return;
    }
    if (result.reason === "funds") {
      player.sendClientMessage(Color.error, "Недостаточно наличных.");
      return;
    }
    if (result.reason === "sold") {
      player.sendClientMessage(Color.error, "Этот бизнес уже куплен.");
      return;
    }
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  if (
    !isPlayerActive(player) ||
    getAccount(player)?.id !== account.id
  ) {
    return;
  }

  const owned = setBusinessOwner(businessId, account.id, account.name);
  if (!owned) {
    player.sendClientMessage(Color.error, "Покупка не прошла. Попробуйте ещё раз.");
    return;
  }

  setBusinessTaxPaidUntil(businessId, currentDateLocal());

  patchAccount(player, { money: result.cashLeft });
  const live = getAccount(player);
  if (live) {
    applyWallet(player, live);
  }

  void saveUserMoney(account.id, result.cashLeft, account.bank).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] не удалось сохранить деньги ${account.name}: ${message}`);
  });

  refreshBusinessLabel(businessId);

  player.sendClientMessage(
    Color.info,
    `Поздравляем с покупкой бизнеса «${owned.name}» (#${owned.id}) за $${owned.price}!`
  );
}
