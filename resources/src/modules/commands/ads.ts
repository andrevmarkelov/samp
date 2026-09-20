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
  `Podacha ob'yavleniya. Stoimost': $${AD_FEE} nalichnymi.`,
  "",
  "Zaprescheno:",
  "- oskorbleniya, kapslok, offtop",
  "- reklama storonnih serverov i cheats",
  "- NRP, ugrozy, obman ot imeni gos. organov",
  "",
  "Vvedite tekst ob'yavleniya:",
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

registerCommand("ad", "Podat' ob'yavlenie", (player) => {
  openSubmitDialog(player);
});

registerCommand("edit", "Proverit' ob'yavlenie radiocentra", (player) => {
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
    tell(player, Color.error, "U vas uzhe est' ob'yavlenie v ocheredi.");
    return;
  }

  if (account.money < AD_FEE) {
    tell(player, Color.error, `Ob'yavlenie stoit $${AD_FEE}. Nedostatochno nalichnyh.`);
    return;
  }

  const prefix = error ? `${error}\n\n` : "";
  try {
    Dialog.show(
      player,
      AD_SUBMIT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Ob'yavlenie",
      `${prefix}${AD_HINT}`,
      "Otpravit'",
      "Otmena"
    );
  } catch {
    tell(player, Color.error, "Ne udalos' otkryt' ob'yavlenie.");
  }
}

async function submitAd(player: Player, raw: string): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (submitting.has(account.id) || hasAdInFlight(account.id)) {
    tell(player, Color.error, "U vas uzhe est' ob'yavlenie v ocheredi.");
    return;
  }

  const text = sanitizeAd(raw);
  if (!text) {
    openSubmitDialog(player, "Vvedite tekst ob'yavleniya.");
    return;
  }

  if (account.money < AD_FEE) {
    tell(player, Color.error, `Ob'yavlenie stoit $${AD_FEE}. Nedostatochno nalichnyh.`);
    return;
  }

  const nextCash = account.money - AD_FEE;
  submitting.add(account.id);
  try {
    await saveUserMoney(account.id, nextCash, account.bank);
  } catch {
    submitting.delete(account.id);
    tell(player, Color.error, "Ne udalos' spisat' oplatu. Poprobuyte eshchyo raz.");
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
    tell(player, Color.info, `Ob'yavlenie otpravleno na proverku. Spisano $${AD_FEE}.`);
  }
  notifyRadioStaff(
    Color.info,
    `Postupilo novoe ob'yavlenie ot ${authorTag}. Vvedite /edit.`
  );
}

function startEdit(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getMembership(account) : null;
  if (!account || membership?.org.id !== ORG_RADIO_ID) {
    tell(player, Color.error, "Vy ne sostoite v radiocentre.");
    return;
  }

  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  if (editing.has(slot) || rejecting.has(slot)) {
    tell(player, Color.error, "Snachala zavershite tekuschee ob'yavlenie.");
    return;
  }

  if (!canEditHere(player)) {
    tell(
      player,
      Color.error,
      "Proveryat' ob'yavleniya mozhno v ofise ili v transporte radiocentra."
    );
    return;
  }

  const ad = pending.shift();
  if (!ad) {
    tell(player, Color.error, "Ochered' ob'yavleniy pusta.");
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
      "Proverka ob'yavleniya",
      `Tekst igroka:\n${ad.text}\n\nIsprav'te tekst nizhe ili ostav'te pole pustym i primite.`,
      "Prinyat'",
      "Otklonit'"
    );
  } catch {
    returnAdFromStaff(player);
    tell(player, Color.error, "Ne udalos' otkryt' proverku.");
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
    tell(player, Color.error, "Vy ne sostoite v radiocentre.");
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

  tell(player, Color.info, "Ob'yavlenie prinyato i vstanet v ochered' efira.");
  notifyAuthor(ad.authorId, Color.info, "Vashe ob'yavlenie provereno i otpravleno.");
}

function showRejectDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  try {
    Dialog.show(
      player,
      AD_REJECT_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Otklonit' ob'yavlenie",
      `${prefix}Ukazhite prichinu otkloneniya.`,
      "Otklonit'",
      "Otmena"
    );
  } catch {
    returnAdFromStaff(player);
    tell(player, Color.error, "Ne udalos' otkryt' prichinu otkloneniya.");
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
    tell(player, Color.error, "Vy ne sostoite v radiocentre.");
    return;
  }

  if (!confirmed) {
    rejecting.delete(slot);
    pending.unshift(ad);
    tell(player, Color.gray, "Otklonenie otmeneno. Ob'yavlenie vernulos' v ochered'.");
    return;
  }

  const reason = sanitizeAd(raw);
  if (!reason) {
    showRejectDialog(player, "Ukazhite prichinu otkloneniya.");
    return;
  }

  rejecting.delete(slot);
  const staff = getAccount(player);
  const verb = byGender(staff?.gender ?? null, "otklonil", "otklonila");
  const staffTag = playerChatName(player);
  const line = clipClientMessage(
    `Sotrudnik radiocentra ${staffTag} ${verb} ob'yavlenie. Prichina: ${reason}`
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

  const sent = byGender(ad.authorGender, "Otpravil", "Otpravila");
  const checked = byGender(ad.editorGender, "proveril", "proverila");
  const text = ad.text.endsWith(".") || ad.text.endsWith("!") || ad.text.endsWith("?")
    ? ad.text
    : `${ad.text}.`;
  const first = clipClientMessage(`LS | ${text} | ${sent} ${ad.authorTag}`);
  const second = clipClientMessage(
    ` Ob'yavlenie ${checked} sotrudnik Radiocentra ${ad.editorTag}`
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
