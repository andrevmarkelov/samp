import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { byGender, type Gender } from "../auth/gender";
import { saveUserMoney } from "../auth/repository";
import { applyWallet, getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { getMembership, ORG_RADIO_ID, RADIO_INTERIOR, RADIO_WORLD } from "../org";
import { isRadioFleetVehicle } from "../vehicles/radio";
import { registerCommand } from "./registry";

export const AD_SUBMIT_DIALOG_ID = 37;
export const AD_EDIT_DIALOG_ID = 38;
export const AD_REJECT_DIALOG_ID = 39;

const DIALOG_STYLE_INPUT = 1;
const AD_FEE = 500;
const AD_MAX_LENGTH = 80;
const DESK_RADIUS = 5;
const PUBLISH_GAP_MS = 3 * 60 * 1000;
const TICK_MS = 1000;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;

const DESK = {
  x: 1424.4587,
  y: 1056.6222,
  z: 1058.7816,
} as const;

const AD_HINT = [
  `Подача объявления. Стоимость: $${AD_FEE} наличными.`,
  "",
  "Запрещено:",
  "- оскорбления, капслок, оффтоп",
  "- реклама сторонних серверов и читов",
  "- NRP, угрозы, обман от имени гос. органов",
  "",
  "Введите текст объявления:",
].join("\n");

type Ad = {
  authorId: number;
  authorName: string;
  authorGender: Gender;
  authorTag: string;
  text: string;
  editorName: string;
  editorGender: Gender;
  editorTag: string;
  publishAt: number;
};

const pending: Ad[] = [];
const publishQueue: Ad[] = [];
const editing = new Map<number, Ad>();
const rejecting = new Map<number, Ad>();
const submitting = new Set<number>();

let lastPublishAt = 0;
let started = false;

registerCommand("ad", "Подать объявление", (player) => {
  openSubmitDialog(player);
});

registerCommand("edit", "Проверить объявление радиоцентра", (player) => {
  startEdit(player);
});

export function bindAds(): void {
  if (started) {
    return;
  }
  started = true;

  setInterval(tickPublish, TICK_MS);

  omp.on("dialogResponse", (player, dialogId, response, _listItem, inputText) => {
    const id = Number(dialogId);
    const text = String(inputText ?? "");

    if (id === AD_SUBMIT_DIALOG_ID) {
      if (Number(response) === 0 || !isAuthenticated(player)) {
        return;
      }
      void submitAd(player, text);
      return;
    }

    if (id === AD_EDIT_DIALOG_ID) {
      onEditResponse(player, Number(response) !== 0, text);
      return;
    }

    if (id === AD_REJECT_DIALOG_ID) {
      onRejectResponse(player, Number(response) !== 0, text);
    }
  });

  omp.on("playerDisconnect", (player) => {
    returnAdToQueue(player);
  });
}

function openSubmitDialog(player: Player, error?: string): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (hasAdInFlight(account.id)) {
    tell(player, Color.error, "У вас уже есть объявление в очереди.");
    return;
  }

  if (account.money < AD_FEE) {
    tell(player, Color.error, `Объявление стоит $${AD_FEE}. Недостаточно наличных.`);
    return;
  }

  const prefix = error ? `${error}\n\n` : "";
  try {
    Dialog.show(
      player,
      AD_SUBMIT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Объявление",
      `${prefix}${AD_HINT}`,
      "Отправить",
      "Отмена"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть объявление.");
  }
}

async function submitAd(player: Player, raw: string): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (submitting.has(account.id) || hasAdInFlight(account.id)) {
    tell(player, Color.error, "У вас уже есть объявление в очереди.");
    return;
  }

  const text = sanitizeAd(raw);
  if (!text) {
    openSubmitDialog(player, "Введите текст объявления.");
    return;
  }

  if (account.money < AD_FEE) {
    tell(player, Color.error, `Объявление стоит $${AD_FEE}. Недостаточно наличных.`);
    return;
  }

  const nextCash = account.money - AD_FEE;
  submitting.add(account.id);
  try {
    await saveUserMoney(account.id, nextCash, account.bank);
  } catch {
    submitting.delete(account.id);
    tell(player, Color.error, "Не удалось списать оплату. Попробуйте ещё раз.");
    return;
  }

  const live = getAccount(player);
  if (live && live.id === account.id) {
    patchAccount(player, { money: nextCash });
    applyWallet(player, { ...live, money: nextCash });
  }

  const authorTag =
    isPlayerActive(player) && live?.id === account.id
      ? playerChatName(player)
      : account.name;
  pending.push({
    authorId: account.id,
    authorName: account.name,
    authorGender: account.gender,
    authorTag,
    text,
    editorName: "",
    editorGender: account.gender,
    editorTag: "",
    publishAt: 0,
  });
  submitting.delete(account.id);

  if (isPlayerActive(player) && live?.id === account.id) {
    tell(player, Color.info, `Объявление отправлено на проверку. Списано $${AD_FEE}.`);
  }
  notifyRadioStaff(
    Color.info,
    `Поступило новое объявление от ${authorTag}. Введите /edit.`
  );
}

function startEdit(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || membership?.org.id !== ORG_RADIO_ID) {
    tell(player, Color.error, "Вы не состоите в радиоцентре.");
    return;
  }

  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  if (editing.has(slot) || rejecting.has(slot)) {
    tell(player, Color.error, "Сначала завершите текущее объявление.");
    return;
  }

  if (!canEditHere(player)) {
    tell(
      player,
      Color.error,
      "Проверять объявления можно в офисе или в транспорте радиоцентра."
    );
    return;
  }

  const ad = pending.shift();
  if (!ad) {
    tell(player, Color.error, "Очередь объявлений пуста.");
    return;
  }

  editing.set(slot, ad);
  showEditDialog(player, ad);
}

function showEditDialog(player: Player, ad: Ad): void {
  try {
    Dialog.show(
      player,
      AD_EDIT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Проверка объявления",
      `Текст игрока:\n${ad.text}\n\nИсправьте текст ниже или оставьте поле пустым и примите.`,
      "Принять",
      "Отклонить"
    );
  } catch {
    returnAdFromStaff(player);
    tell(player, Color.error, "Не удалось открыть проверку.");
  }
}

function onEditResponse(player: Player, accepted: boolean, raw: string): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const ad = editing.get(slot);
  if (!ad) {
    return;
  }

  if (!isRadioStaff(player)) {
    returnAdFromStaff(player);
    tell(player, Color.error, "Вы не состоите в радиоцентре.");
    return;
  }

  if (!accepted) {
    editing.delete(slot);
    rejecting.set(slot, ad);
    showRejectDialog(player);
    return;
  }

  const edited = sanitizeAd(raw);
  ad.text = edited || ad.text;
  if (!ad.text) {
    showEditDialog(player, ad);
    return;
  }

  const editor = getAccount(player);
  if (!editor) {
    returnAdFromStaff(player);
    return;
  }

  editing.delete(slot);
  ad.editorName = editor.name;
  ad.editorGender = editor.gender;
  ad.editorTag = playerChatName(player);
  ad.publishAt = nextPublishAt();
  publishQueue.push(ad);

  tell(player, Color.info, "Объявление принято и встанет в очередь эфира.");
  notifyAuthor(ad.authorId, Color.info, "Ваше объявление проверено и отправлено.");
}

function showRejectDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  try {
    Dialog.show(
      player,
      AD_REJECT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Отклонить объявление",
      `${prefix}Укажите причину отклонения.`,
      "Отклонить",
      "Отмена"
    );
  } catch {
    returnAdFromStaff(player);
    tell(player, Color.error, "Не удалось открыть причину отклонения.");
  }
}

function onRejectResponse(player: Player, confirmed: boolean, raw: string): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const ad = rejecting.get(slot);
  if (!ad) {
    return;
  }

  if (!isRadioStaff(player)) {
    returnAdFromStaff(player);
    tell(player, Color.error, "Вы не состоите в радиоцентре.");
    return;
  }

  if (!confirmed) {
    rejecting.delete(slot);
    pending.unshift(ad);
    tell(player, Color.gray, "Отклонение отменено. Объявление вернулось в очередь.");
    return;
  }

  const reason = sanitizeAd(raw);
  if (!reason) {
    showRejectDialog(player, "Укажите причину отклонения.");
    return;
  }

  rejecting.delete(slot);
  const staff = getAccount(player);
  const verb = byGender(staff?.gender ?? null, "отклонил", "отклонила");
  const staffTag = playerChatName(player);
  const line = clipClientMessage(
    `Сотрудник радиоцентра ${staffTag} ${verb} объявление. Причина: ${reason}`
  );
  notifyAuthor(ad.authorId, Color.error, line);
  notifyRadioStaff(Color.error, line);
}

function tickPublish(): void {
  const ad = publishQueue[0];
  if (!ad || Date.now() < ad.publishAt) {
    return;
  }

  publishQueue.shift();
  lastPublishAt = Date.now();

  const sent = byGender(ad.authorGender, "Отправил", "Отправила");
  const checked = byGender(ad.editorGender, "проверил", "проверила");
  const text = ad.text.endsWith(".") || ad.text.endsWith("!") || ad.text.endsWith("?")
    ? ad.text
    : `${ad.text}.`;
  const first = clipClientMessage(`LS | ${text} | ${sent} ${ad.authorTag}`);
  const second = clipClientMessage(
    ` Объявление ${checked} сотрудник Радиоцентра ${ad.editorTag}`
  );

  broadcast(Color.ad, first);
  broadcast(Color.adChecked, second);
}

function nextPublishAt(): number {
  const soonest = Date.now() + PUBLISH_GAP_MS;
  const afterLast = lastPublishAt > 0 ? lastPublishAt + PUBLISH_GAP_MS : 0;
  const afterQueued = publishQueue.reduce(
    (latest, item) => Math.max(latest, item.publishAt + PUBLISH_GAP_MS),
    0
  );
  return Math.max(soonest, afterLast, afterQueued);
}

function isRadioStaff(player: Player): boolean {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  return membership?.org.id === ORG_RADIO_ID;
}

function canEditHere(player: Player): boolean {
  try {
    const state = player.getState();
    if (state === PLAYER_STATE_DRIVER || state === PLAYER_STATE_PASSENGER) {
      const vehicle = omp.vehicles.at(player.getVehicleID());
      return !!vehicle && isRadioFleetVehicle(vehicle);
    }

    if (
      player.getVirtualWorld() !== RADIO_WORLD ||
      player.getInterior() !== RADIO_INTERIOR
    ) {
      return false;
    }

    const pos = player.getPos();
    return (
      Math.hypot(pos.x - DESK.x, pos.y - DESK.y, pos.z - DESK.z) <= DESK_RADIUS
    );
  } catch {
    return false;
  }
}

function hasAdInFlight(authorId: number): boolean {
  if (submitting.has(authorId)) {
    return true;
  }
  if (pending.some((ad) => ad.authorId === authorId)) {
    return true;
  }
  if (publishQueue.some((ad) => ad.authorId === authorId)) {
    return true;
  }
  for (const ad of editing.values()) {
    if (ad.authorId === authorId) {
      return true;
    }
  }
  for (const ad of rejecting.values()) {
    if (ad.authorId === authorId) {
      return true;
    }
  }
  return false;
}

function returnAdFromStaff(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const ad = editing.get(slot) ?? rejecting.get(slot);
  editing.delete(slot);
  rejecting.delete(slot);
  if (ad) {
    pending.unshift(ad);
  }
}

function returnAdToQueue(player: Player): void {
  returnAdFromStaff(player);
}

function notifyAuthor(authorId: number, color: number, text: string): void {
  const target = findByAccountId(authorId);
  if (target) {
    tell(target, color, text);
  }
}

function notifyRadioStaff(color: number, text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || isNpc(other)) {
      return;
    }

    const account = getAccount(other);
    const membership = account ? getMembership(account) : null;
    if (membership?.org.id !== ORG_RADIO_ID) {
      return;
    }

    tell(other, color, text);
  });
}

function broadcast(color: number, text: string): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || isNpc(other)) {
      return;
    }

    tell(other, color, text);
  });
}

function findByAccountId(accountId: number): Player | null {
  for (const other of omp.players.all()) {
    if (!isPlayerActive(other) || getAccount(other)?.id !== accountId) {
      continue;
    }
    return other;
  }
  return null;
}

function sanitizeAd(raw: string): string {
  return sanitizeChatText(raw.trim()).slice(0, AD_MAX_LENGTH);
}

function isNpc(player: Player): boolean {
  try {
    return player.isNPC();
  } catch {
    return false;
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    player.sendClientMessage(color, clipClientMessage(text));
  } catch {
    // Слот пустой.
  }
}
