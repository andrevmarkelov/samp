import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { isArmyFactoryOnShift } from "../army-factory";
import { genderLabel, type Gender } from "../auth/gender";
import { LICENSE_ROWS, type Licenses } from "../auth/licenses";
import {
  holdDonateWallet,
  isDonateBusy,
  lockDonate,
  releaseDonateWallet,
  unlockDonate,
} from "../auth/donate-guard";
import {
  convertDonateToCash,
  claimUserPhone,
  grantUserLawfulness,
  refundUserDonate,
  saveUserGender,
  saveUserLicenses,
  saveUserMedcard,
  saveUserMilitaryId,
  saveUserSkin,
  saveUserOrg,
  saveUserWantedLevel,
  spendUserDonate,
} from "../auth/repository";
import { isSkinPicking } from "../auth/skin-picker";
import { SKINS, hasSkin, type SkinOption } from "../auth/skins";
import {
  MAX_LAWFULNESS,
  PHONE_DIGITS,
  applyWallet,
  getAccount,
  isAuthenticated,
  normalizeLawfulness,
  patchAccount,
  type Account,
} from "../auth/session";
import { setPlayerWantedLevel } from "../auth/wanted";
import { isLoaderOnShift } from "../loader";
import { isMinerOnShift } from "../miner";
import { applyOrgVisuals, getMembership, MAX_ORG_RANK, ORG_NONE, resolvePlayerSkin } from "../org";
import { syncOrgVehicleAccess } from "../vehicles/access";
import { refreshCaptureView } from "../zones/capture";
import { registerCommand } from "./registry";

export const DONATE_MENU_DIALOG_ID = 160;
export const DONATE_CONVERT_DIALOG_ID = 161;
export const DONATE_SKIN_DIALOG_ID = 162;
export const DONATE_PHONE_DIALOG_ID = 163;

const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_TABLIST_HEADERS = 5;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

/** 1 единица донат-счёта. */
const CASH_PER_DONATE = 2500;
const MAX_MONEY = 2_000_000_000;

const PRICE_GENDER = 30;
const PRICE_LICENSES = 25;
const PRICE_MEDCARD = 10;
const PRICE_MILITARY = 15;
const PRICE_WANTED = 8;
const PRICE_LAW = 5;
const LAW_GAIN = 5;
const PRICE_LEAVE_ORG = 50;
const PRICE_PHONE = 20;

const SKIN_PRICE: Readonly<Record<number, number>> = {
  78: 5,
  79: 5,
  134: 5,
  136: 8,
  137: 5,
  160: 10,
  200: 10,
  212: 5,
  213: 12,
  230: 5,
  239: 5,
  77: 5,
  90: 8,
  93: 8,
  131: 10,
  151: 8,
  157: 10,
  190: 15,
  192: 15,
  198: 10,
  201: 10,
  211: 12,
};

const DEFAULT_SKIN: Record<Gender, number> = {
  male: 136,
  female: 93,
};

type MenuAction =
  | "convert"
  | "skin"
  | "gender"
  | "licenses"
  | "medcard"
  | "military"
  | "wanted"
  | "law"
  | "org"
  | "phone";

const MENU: readonly { action: MenuAction; label: string; price: string }[] = [
  { action: "convert", label: "Конвертировать в деньги", price: `1 = ${formatMoney(CASH_PER_DONATE)}` },
  { action: "skin", label: "Изменить скин", price: "от 5" },
  { action: "gender", label: "Изменить пол", price: String(PRICE_GENDER) },
  { action: "licenses", label: "Все лицензии", price: String(PRICE_LICENSES) },
  { action: "medcard", label: "Медкарта", price: String(PRICE_MEDCARD) },
  { action: "military", label: "Военный билет", price: String(PRICE_MILITARY) },
  { action: "wanted", label: "Понизить розыск", price: String(PRICE_WANTED) },
  { action: "law", label: "Законопослушность +5", price: String(PRICE_LAW) },
  { action: "org", label: "Уволиться из организации", price: String(PRICE_LEAVE_ORG) },
  { action: "phone", label: "Изменить номер телефона", price: String(PRICE_PHONE) },
];

/** Скины, которые были в открытом списке у слота. */
const skinOffer = new Map<number, readonly SkinOption[]>();

registerCommand("donate", "Донат-счёт: обмен и услуги", (player) => {
  showDonateMenu(player);
});

export function bindDonateDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (
      id !== DONATE_MENU_DIALOG_ID &&
      id !== DONATE_CONVERT_DIALOG_ID &&
      id !== DONATE_SKIN_DIALOG_ID &&
      id !== DONATE_PHONE_DIALOG_ID
    ) {
      return;
    }

    const ok = Number(response) !== 0;
    const input = String(inputText ?? "");
    const item = Number(listItem);

    if (id === DONATE_MENU_DIALOG_ID) {
      void onMenu(player, ok, item);
      return;
    }

    if (id === DONATE_CONVERT_DIALOG_ID) {
      void onConvert(player, ok, input);
      return;
    }

    if (id === DONATE_PHONE_DIALOG_ID) {
      void onPhone(player, ok, input);
      return;
    }

    void onSkin(player, ok, item);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      skinOffer.delete(slotId);
    }
  });
}

function showDonateMenu(player: Player): void {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (isDonateBusy(player)) {
    player.sendClientMessage(Color.error, "Подождите, предыдущая покупка ещё выполняется.");
    return;
  }

  if (isSkinPicking(player)) {
    player.sendClientMessage(Color.error, "Сначала закончи выбор скина.");
    return;
  }

  const body = ["Услуга\tЦена", ...MENU.map((row) => `${row.label}\t${row.price}`)].join("\n");

  try {
    Dialog.show(
      player,
      DONATE_MENU_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      `Донат-счёт: ${account.donate}`,
      body,
      "Выбрать",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть донат-меню.");
  }
}

async function onMenu(player: Player, ok: boolean, listItem: number): Promise<void> {
  if (!ok) {
    return;
  }

  const row = MENU[listItem];
  if (!row) {
    return;
  }

  if (row.action === "convert") {
    showConvert(player);
    return;
  }

  if (row.action === "skin") {
    showSkins(player);
    return;
  }

  if (row.action === "phone") {
    showPhone(player);
    return;
  }

  await runLocked(player, async () => {
    if (row.action === "gender") {
      await buyGender(player);
      return;
    }

    if (row.action === "licenses") {
      await buyLicenses(player);
      return;
    }

    if (row.action === "medcard") {
      await buyMedcard(player);
      return;
    }

    if (row.action === "military") {
      await buyMilitary(player);
      return;
    }

    if (row.action === "wanted") {
      await buyWanted(player);
      return;
    }

    if (row.action === "org") {
      await buyLeaveOrg(player);
      return;
    }

    await buyLaw(player);
  });
}

function showConvert(player: Player): void {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  try {
    Dialog.show(
      player,
      DONATE_CONVERT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Конвертация",
      `Курс: 1 донат-счёт = ${formatMoney(CASH_PER_DONATE)}\nНа счёте: ${account.donate}\n\nСколько списать?`,
      "Обменять",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть обмен.");
  }
}

async function onConvert(player: Player, ok: boolean, input: string): Promise<void> {
  if (!ok) {
    showDonateMenu(player);
    return;
  }

  await runLocked(player, async (slotId) => {
    holdDonateWallet(slotId);
    try {
      await exchangeDonate(player, input);
    } finally {
      releaseDonateWallet(slotId);
    }
  });
}

async function exchangeDonate(player: Player, input: string): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  const amount = Number(input.trim());
  if (!Number.isSafeInteger(amount) || amount < 1) {
    player.sendClientMessage(Color.error, "Введите целое число больше нуля.");
    showConvert(player);
    return;
  }

  if (amount > account.donate) {
    player.sendClientMessage(Color.error, "Недостаточно донат-счёта.");
    showConvert(player);
    return;
  }

  const cash = amount * CASH_PER_DONATE;
  const money = account.money + cash;
  if (!Number.isSafeInteger(cash) || !Number.isSafeInteger(money) || money > MAX_MONEY) {
    player.sendClientMessage(Color.error, "Слишком много наличных, обмен невозможен.");
    return;
  }

  const userId = account.id;
  let spent = false;
  try {
    spent = await convertDonateToCash(userId, amount, cash, MAX_MONEY);
  } catch {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Не удалось обменять донат-счёт.");
    }
    return;
  }

  if (!spent) {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Недостаточно донат-счёта или слишком много наличных.");
    }
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== userId || !isPlayerActive(player)) {
    return;
  }

  const donate = Math.max(0, live.donate - amount);
  const nextMoney = live.money + cash;
  patchAccount(player, { money: nextMoney, donate });
  applyWallet(player, { ...live, money: nextMoney, donate });
  player.sendClientMessage(
    Color.info,
    `Вы обменяли ${amount} донат-счёта на ${formatMoney(cash)}. Осталось: ${donate}.`
  );
}

function showPhone(player: Player): void {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  const current = account.phone ?? "нет";

  try {
    Dialog.show(
      player,
      DONATE_PHONE_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Номер телефона",
      `Ровно ${PHONE_DIGITS} цифр, например 000000.\nСейчас: ${current}\nЦена: ${PRICE_PHONE}\n\nНовый номер:`,
      "Сменить",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть смену номера.");
  }
}

async function onPhone(player: Player, ok: boolean, input: string): Promise<void> {
  if (!ok) {
    showDonateMenu(player);
    return;
  }

  await runLocked(player, async () => {
    await buyPhone(player, input);
  });
}

async function buyPhone(player: Player, input: string): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  const phone = parsePhone(input);
  if (!phone) {
    player.sendClientMessage(Color.error, `Номер — ровно ${PHONE_DIGITS} цифр, без пробелов.`);
    showPhone(player);
    return;
  }

  if (account.phone === phone) {
    player.sendClientMessage(Color.error, "Это уже ваш номер.");
    showPhone(player);
    return;
  }

  const userId = account.id;
  if (!(await charge(player, userId, PRICE_PHONE))) {
    return;
  }

  let result: "ok" | "taken" | "missing";
  try {
    result = await claimUserPhone(userId, phone);
  } catch {
    await refund(player, userId, PRICE_PHONE);
    return;
  }

  if (result === "taken") {
    await refund(player, userId, PRICE_PHONE, "Этот номер уже занят. Донат-счёт возвращён.");
    return;
  }

  if (result !== "ok") {
    await refund(player, userId, PRICE_PHONE);
    return;
  }

  remember(player, userId, { phone });
  if (samePlayer(player, userId)) {
    player.sendClientMessage(Color.info, `Номер изменён на ${phone}. Списано ${PRICE_PHONE}.`);
  }
}

async function buyLeaveOrg(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  const membership = getMembership(account);
  if (!membership && account.orgId === ORG_NONE) {
    player.sendClientMessage(Color.error, "Вы не состоите в организации.");
    return;
  }

  if (membership && membership.rank.id === MAX_ORG_RANK) {
    player.sendClientMessage(Color.error, "Лидер не может уволиться через донат.");
    return;
  }

  const orgName = membership?.org.name ?? "организации";
  const userId = account.id;
  if (!(await charge(player, userId, PRICE_LEAVE_ORG))) {
    return;
  }

  const after = getAccount(player);
  if (after && after.id === userId) {
    const now = getMembership(after);
    if (now && now.rank.id === MAX_ORG_RANK) {
      await refund(player, userId, PRICE_LEAVE_ORG, "Вы стали лидером. Донат-счёт возвращён.");
      return;
    }
    if (!now && after.orgId === ORG_NONE) {
      await refund(player, userId, PRICE_LEAVE_ORG, "Вы уже не в организации. Донат-счёт возвращён.");
      return;
    }
  }

  try {
    await saveUserOrg(userId, ORG_NONE, 0);
  } catch {
    await refund(player, userId, PRICE_LEAVE_ORG);
    return;
  }

  if (!samePlayer(player, userId)) {
    return;
  }

  patchAccount(player, { orgId: ORG_NONE, orgRank: 0 });
  if (canShowSkin(player)) {
    applyOrgVisuals(player);
  }
  syncOrgVehicleAccess(player);
  refreshCaptureView(player);
  player.sendClientMessage(
    Color.info,
    `Вы уволились из организации ${orgName}. Списано ${PRICE_LEAVE_ORG}.`
  );
}

function parsePhone(input: string): string | null {
  const raw = input.trim();
  if (!new RegExp(`^\\d{${PHONE_DIGITS}}$`).test(raw)) {
    return null;
  }
  return raw;
}

function showSkins(player: Player): void {
  const account = liveAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const options = SKINS[account.gender];
  skinOffer.set(slotId, options);

  const body = [
    "Скин\tID\tЦена",
    ...options.map((skin) => `${skin.label}\t${skin.id}\t${skinPrice(skin.id)}`),
  ].join("\n");

  try {
    Dialog.show(
      player,
      DONATE_SKIN_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      `Скины: ${genderLabel(account.gender)}`,
      body,
      "Купить",
      "Назад"
    );
  } catch {
    skinOffer.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть список скинов.");
  }
}

async function onSkin(player: Player, ok: boolean, listItem: number): Promise<void> {
  const slotId = playerId(player);
  const options = slotId === null ? undefined : skinOffer.get(slotId);
  if (slotId !== null) {
    skinOffer.delete(slotId);
  }

  if (!ok) {
    showDonateMenu(player);
    return;
  }

  const skin = options?.[listItem];
  if (!skin) {
    return;
  }

  await runLocked(player, async () => {
    await buySkin(player, skin);
  });
}

async function buySkin(player: Player, skin: SkinOption): Promise<void> {
  const account = liveAccount(player);
  if (!account || !hasSkin(account.gender, skin.id)) {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Этот скин недоступен.");
    }
    return;
  }

  if (account.skin === skin.id) {
    player.sendClientMessage(Color.error, "Этот скин уже куплен.");
    showSkins(player);
    return;
  }

  const price = skinPrice(skin.id);
  const userId = account.id;
  if (!(await charge(player, userId, price))) {
    return;
  }

  const charged = getAccount(player);
  if (charged && charged.id === userId && charged.skin === skin.id) {
    await refund(player, userId, price, "Этот скин уже куплен. Донат-счёт возвращён.");
    return;
  }

  try {
    await saveUserSkin(userId, skin.id);
  } catch {
    await refund(player, userId, price);
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== userId || !isPlayerActive(player)) {
    return;
  }

  patchAccount(player, { skin: skin.id });
  const visible = canShowSkin(player);
  if (visible) {
    applyOrgVisuals(player);
  }

  const updated = getAccount(player);
  const worn = visible && updated !== null && resolvePlayerSkin(updated) === skin.id;
  player.sendClientMessage(
    Color.info,
    worn
      ? `Вы сменили скин на ${skin.label}. Списано ${price}.`
      : `Скин ${skin.label} сохранён. Сейчас на вас другая форма. Списано ${price}.`
  );
}

async function buyGender(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  const next: Gender = account.gender === "female" ? "male" : "female";
  const skin = hasSkin(next, account.skin) ? account.skin : defaultSkin(next);
  const userId = account.id;
  if (!(await charge(player, userId, PRICE_GENDER))) {
    return;
  }

  try {
    await saveUserGender(userId, next, skin);
  } catch {
    await refund(player, userId, PRICE_GENDER);
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== userId || !isPlayerActive(player)) {
    return;
  }

  patchAccount(player, { gender: next, skin });
  if (canShowSkin(player)) {
    applyOrgVisuals(player);
  }

  const label = SKINS[next].find((option) => option.id === skin)?.label ?? String(skin);
  player.sendClientMessage(
    Color.info,
    `Пол изменён на ${genderLabel(next).toLowerCase()}. Скин: ${label}. Списано ${PRICE_GENDER}.`
  );
}

async function buyLicenses(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (LICENSE_ROWS.every((row) => account.licenses[row.key])) {
    player.sendClientMessage(Color.error, "Все лицензии уже есть.");
    return;
  }

  const userId = account.id;
  if (!(await charge(player, userId, PRICE_LICENSES))) {
    return;
  }

  const after = getAccount(player);
  if (after && after.id === userId && LICENSE_ROWS.every((row) => after.licenses[row.key])) {
    await refund(player, userId, PRICE_LICENSES, "Все лицензии уже есть. Донат-счёт возвращён.");
    return;
  }

  const licenses: Licenses = {
    car: true,
    moto: true,
    fly: true,
    boat: true,
    gun: true,
  };

  try {
    await saveUserLicenses(userId, licenses);
  } catch {
    await refund(player, userId, PRICE_LICENSES);
    return;
  }

  remember(player, userId, { licenses });
  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.info, `Выданы все лицензии. Списано ${PRICE_LICENSES}.`);
  }
}

async function buyMedcard(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (account.medcard) {
    player.sendClientMessage(Color.error, "Медкарта уже есть.");
    return;
  }

  const userId = account.id;
  if (!(await charge(player, userId, PRICE_MEDCARD))) {
    return;
  }

  const after = getAccount(player);
  if (after && after.id === userId && after.medcard) {
    await refund(player, userId, PRICE_MEDCARD, "Медкарта уже есть. Донат-счёт возвращён.");
    return;
  }

  try {
    await saveUserMedcard(userId, true);
  } catch {
    await refund(player, userId, PRICE_MEDCARD);
    return;
  }

  remember(player, userId, { medcard: true });
  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.info, `Медкарта куплена. Списано ${PRICE_MEDCARD}.`);
  }
}

async function buyMilitary(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (account.militaryId) {
    player.sendClientMessage(Color.error, "Военный билет уже есть.");
    return;
  }

  const userId = account.id;
  if (!(await charge(player, userId, PRICE_MILITARY))) {
    return;
  }

  const after = getAccount(player);
  if (after && after.id === userId && after.militaryId) {
    await refund(player, userId, PRICE_MILITARY, "Военный билет уже есть. Донат-счёт возвращён.");
    return;
  }

  try {
    await saveUserMilitaryId(userId, true);
  } catch {
    await refund(player, userId, PRICE_MILITARY);
    return;
  }

  remember(player, userId, { militaryId: true });
  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.info, `Военный билет куплен. Списано ${PRICE_MILITARY}.`);
  }
}

async function buyWanted(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (account.wantedLevel <= 0) {
    player.sendClientMessage(Color.error, "Вас никто не разыскивает.");
    return;
  }

  const userId = account.id;
  const fallback = account.wantedLevel - 1;
  if (!(await charge(player, userId, PRICE_WANTED))) {
    return;
  }

  const live = getAccount(player);
  if (!live || live.id !== userId || !isPlayerActive(player)) {
    try {
      await saveUserWantedLevel(userId, fallback);
    } catch {
      await refund(player, userId, PRICE_WANTED);
    }
    return;
  }

  if (live.wantedLevel <= 0) {
    await refund(player, userId, PRICE_WANTED, "Вас уже никто не разыскивает. Донат-счёт возвращён.");
    return;
  }

  const next = live.wantedLevel - 1;
  try {
    await saveUserWantedLevel(userId, next);
  } catch {
    await refund(player, userId, PRICE_WANTED);
    return;
  }

  const still = getAccount(player);
  if (!still || still.id !== userId || !isPlayerActive(player)) {
    return;
  }

  setPlayerWantedLevel(player, next);
  player.sendClientMessage(Color.info, `Розыск снижен до ${next}. Списано ${PRICE_WANTED}.`);
}

async function buyLaw(player: Player): Promise<void> {
  const account = liveAccount(player);
  if (!account) {
    return;
  }

  if (account.lawfulness >= MAX_LAWFULNESS) {
    player.sendClientMessage(Color.error, "Законопослушность уже максимальная.");
    return;
  }

  const userId = account.id;
  if (!(await charge(player, userId, PRICE_LAW))) {
    return;
  }

  let granted = false;
  try {
    granted = await grantUserLawfulness(userId, LAW_GAIN);
  } catch {
    await refund(player, userId, PRICE_LAW);
    return;
  }

  if (!granted) {
    await refund(player, userId, PRICE_LAW, "Законопослушность уже максимальная. Донат-счёт возвращён.");
    return;
  }

  const live = getAccount(player);
  const base = live && live.id === userId ? live.lawfulness : account.lawfulness;
  const next = normalizeLawfulness(base + LAW_GAIN);
  remember(player, userId, { lawfulness: next });
  if (samePlayer(player, userId)) {
    player.sendClientMessage(Color.info, `Законопослушность: ${next}. Списано ${PRICE_LAW}.`);
  }
}

function skinPrice(skinId: number): number {
  return SKIN_PRICE[skinId] ?? 10;
}

function defaultSkin(gender: Gender): number {
  const preferred = DEFAULT_SKIN[gender];
  if (hasSkin(gender, preferred)) {
    return preferred;
  }
  return SKINS[gender][0]?.id ?? preferred;
}

function liveAccount(player: Player): Account | null {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return null;
  }
  return getAccount(player);
}

function canShowSkin(player: Player): boolean {
  if (isMinerOnShift(player) || isLoaderOnShift(player) || isArmyFactoryOnShift(player)) {
    return false;
  }

  try {
    if (!player.isSpawned()) {
      return false;
    }

    const state = player.getState();
    return state !== PLAYER_STATE_WASTED && state !== PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function samePlayer(player: Player, userId: number): boolean {
  return isPlayerActive(player) && getAccount(player)?.id === userId;
}

async function runLocked(player: Player, task: (slotId: number) => Promise<void>): Promise<void> {
  const slotId = lockDonate(player);
  if (slotId === null) {
    if (isPlayerActive(player) && isDonateBusy(player)) {
      player.sendClientMessage(Color.error, "Подождите, предыдущая покупка ещё выполняется.");
    }
    return;
  }

  try {
    await task(slotId);
  } finally {
    unlockDonate(slotId);
  }
}

async function charge(player: Player, userId: number, price: number): Promise<boolean> {
  const before = getAccount(player);
  if (!before || before.id !== userId || !isPlayerActive(player)) {
    return false;
  }

  if (before.donate < price) {
    player.sendClientMessage(Color.error, "Недостаточно донат-счёта.");
    return false;
  }

  let spent = false;
  try {
    spent = await spendUserDonate(userId, price);
  } catch {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Не удалось списать донат-счёт.");
    }
    return false;
  }

  if (!spent) {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Недостаточно донат-счёта.");
    }
    return false;
  }

  const live = getAccount(player);
  if (live && live.id === userId) {
    patchAccount(player, { donate: Math.max(0, live.donate - price) });
  }
  return true;
}

async function refund(
  player: Player,
  userId: number,
  price: number,
  message = "Не удалось выдать услугу. Донат-счёт возвращён."
): Promise<void> {
  try {
    await refundUserDonate(userId, price);
  } catch {
    if (isPlayerActive(player)) {
      player.sendClientMessage(Color.error, "Оплата прошла, но услугу сохранить не удалось.");
    }
    return;
  }

  const live = getAccount(player);
  if (live && live.id === userId) {
    patchAccount(player, { donate: live.donate + price });
  }

  if (isPlayerActive(player)) {
    player.sendClientMessage(Color.error, message);
  }
}

function remember(player: Player, userId: number, patch: Parameters<typeof patchAccount>[1]): void {
  const live = getAccount(player);
  if (!live || live.id !== userId || !isPlayerActive(player)) {
    return;
  }
  patchAccount(player, patch);
}
