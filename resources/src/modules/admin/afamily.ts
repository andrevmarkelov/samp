import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { getFamily, listFamilies } from "../family/catalog";
import { normalizeFamilyName } from "../family/create-office";
import {
  countFamilyMembers,
  deleteFamily,
  findFamilyByName,
  findUserNameById,
  updateFamilyDescription,
  updateFamilyName,
} from "../family/repository";
import { clearFamilyTag, refreshFamilyTags } from "../family/tags";
import {
  FAMILY_DESC_MAX,
  FAMILY_NAME_MAX,
  FAMILY_NAME_MIN,
  FAMILY_NONE,
  type FamilyRecord,
} from "../family/types";
import { hasAdminAccess } from "./session";

export const AFAMILY_LIST_DIALOG_ID = 130;
export const AFAMILY_HUB_DIALOG_ID = 131;
export const AFAMILY_INFO_DIALOG_ID = 132;
export const AFAMILY_MANAGE_DIALOG_ID = 133;
export const AFAMILY_RENAME_DIALOG_ID = 134;
export const AFAMILY_REDESC_DIALOG_ID = 135;
export const AFAMILY_DELETE_DIALOG_ID = 136;

const MIN_LEVEL = 5;
const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_LIST = 2;
const PAGE_SIZE = 16;
const BACK_LABEL = "<<< Назад";
const NEXT_LABEL = ">>> Далее";

type PageSnap = {
  ids: readonly number[];
  hasBack: boolean;
  hasNext: boolean;
};

const pageByPlayer = new Map<number, number>();
/** Снимок страницы списка — listItem берём только из него. */
const pageSnapByPlayer = new Map<number, PageSnap>();
const selectedFamily = new Map<number, number>();

const ALL_DIALOG_IDS = new Set([
  AFAMILY_LIST_DIALOG_ID,
  AFAMILY_HUB_DIALOG_ID,
  AFAMILY_INFO_DIALOG_ID,
  AFAMILY_MANAGE_DIALOG_ID,
  AFAMILY_RENAME_DIALOG_ID,
  AFAMILY_REDESC_DIALOG_ID,
  AFAMILY_DELETE_DIALOG_ID,
]);

export function bindAdminAfamily(): void {
  registerCommand(
    "afamily",
    "Управление семьями",
    (player) => {
      if (!hasAdminAccess(player, MIN_LEVEL)) {
        return;
      }

      showList(player, 0);
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (!ALL_DIALOG_IDS.has(id)) {
      return;
    }

    if (!hasAdminAccess(player, MIN_LEVEL)) {
      clearState(player);
      return;
    }

    const accepted = Number(response) !== 0;
    const text = String(inputText ?? "");

    if (id === AFAMILY_LIST_DIALOG_ID) {
      onListResponse(player, accepted, Number(listItem), text);
      return;
    }

    if (id === AFAMILY_HUB_DIALOG_ID) {
      if (!accepted) {
        const slot = playerId(player);
        const page = slot !== null ? (pageByPlayer.get(slot) ?? 0) : 0;
        if (slot !== null) {
          selectedFamily.delete(slot);
        }
        showList(player, page);
        return;
      }
      onHubPick(player, Number(listItem));
      return;
    }

    if (id === AFAMILY_INFO_DIALOG_ID) {
      if (accepted) {
        showHub(player);
      }
      return;
    }

    if (id === AFAMILY_MANAGE_DIALOG_ID) {
      if (!accepted) {
        showHub(player);
        return;
      }
      onManagePick(player, Number(listItem));
      return;
    }

    if (id === AFAMILY_RENAME_DIALOG_ID) {
      if (!accepted) {
        showManage(player);
        return;
      }
      void renameSelected(player, text);
      return;
    }

    if (id === AFAMILY_REDESC_DIALOG_ID) {
      if (!accepted) {
        showManage(player);
        return;
      }
      void redescSelected(player, text);
      return;
    }

    if (id === AFAMILY_DELETE_DIALOG_ID) {
      if (!accepted) {
        showManage(player);
        return;
      }
      void deleteSelected(player);
    }
  });

  omp.on("playerConnect", (player) => {
    clearState(player);
  });
  omp.on("playerDisconnect", (player) => {
    clearState(player);
  });
}

function familiesSorted(): FamilyRecord[] {
  return [...listFamilies()].sort((a, b) => a.id - b.id);
}

function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function clampPage(page: number, total: number): number {
  return Math.min(pageCount(total) - 1, Math.max(0, page));
}

function buildPage(
  page: number,
  all: readonly FamilyRecord[]
): { lines: string[]; snap: PageSnap } {
  const start = page * PAGE_SIZE;
  const items = all.slice(start, start + PAGE_SIZE);
  const ids = items.map((family) => family.id);
  const hasBack = page > 0;
  const hasNext = page + 1 < pageCount(all.length);
  const lines: string[] = [];

  if (hasBack) {
    lines.push(BACK_LABEL);
  }

  for (const family of items) {
    lines.push(`${family.id}. ${family.name}`);
  }

  if (hasNext) {
    lines.push(NEXT_LABEL);
  }

  return { lines, snap: { ids, hasBack, hasNext } };
}

function showList(player: Player, page: number): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const all = familiesSorted();
  if (all.length === 0) {
    player.sendClientMessage(Color.error, "Семей пока нет.");
    clearState(player);
    return;
  }

  const safePage = clampPage(page, all.length);
  const { lines, snap } = buildPage(safePage, all);
  pageByPlayer.set(slot, safePage);
  pageSnapByPlayer.set(slot, snap);

  try {
    Dialog.show(
      player,
      AFAMILY_LIST_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Семьи (${safePage + 1}/${pageCount(all.length)})`,
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    clearState(player);
    player.sendClientMessage(Color.error, "Не удалось открыть список семей.");
  }
}

function onListResponse(
  player: Player,
  accepted: boolean,
  listItem: number,
  inputText: string
): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const page = pageByPlayer.get(slot) ?? 0;
  if (!accepted) {
    clearState(player);
    return;
  }

  const picked = pickFromPage(slot, listItem, inputText);
  if (picked === "back") {
    showList(player, page - 1);
    return;
  }

  if (picked === "next") {
    showList(player, page + 1);
    return;
  }

  if (picked === null) {
    showList(player, page);
    return;
  }

  selectedFamily.set(slot, picked);
  showHub(player);
}

function pickFromPage(
  slot: number,
  listItem: number,
  inputText: string
): number | "back" | "next" | null {
  const snap = pageSnapByPlayer.get(slot);
  if (!snap) {
    return null;
  }

  const { ids, hasBack, hasNext } = snap;
  const offset = hasBack ? 1 : 0;
  const raw = inputText.trim().toLowerCase();

  if (raw === BACK_LABEL.toLowerCase() || (hasBack && listItem === 0)) {
    return "back";
  }

  if (
    raw === NEXT_LABEL.toLowerCase() ||
    (hasNext && listItem === offset + ids.length)
  ) {
    return "next";
  }

  const index = listItem - offset;
  if (index < 0 || index >= ids.length) {
    return null;
  }

  const familyId = ids[index];
  if (familyId === undefined || !getFamily(familyId)) {
    return null;
  }

  return familyId;
}

function requireSelected(player: Player): FamilyRecord | null {
  const slot = playerId(player);
  if (slot === null) {
    return null;
  }

  const familyId = selectedFamily.get(slot);
  if (familyId === undefined) {
    return null;
  }

  const family = getFamily(familyId);
  if (!family) {
    selectedFamily.delete(slot);
    player.sendClientMessage(Color.error, "Семья больше не существует.");
    showList(player, pageByPlayer.get(slot) ?? 0);
    return null;
  }

  return family;
}

function showHub(player: Player): void {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  try {
    Dialog.show(
      player,
      AFAMILY_HUB_DIALOG_ID,
      DIALOG_STYLE_LIST,
      family.name,
      "1. Информация\n2. Управление",
      "Выбрать",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть меню семьи.");
  }
}

function onHubPick(player: Player, listItem: number): void {
  if (!requireSelected(player)) {
    return;
  }

  if (listItem === 0) {
    void showInfo(player);
    return;
  }

  if (listItem === 1) {
    showManage(player);
  }
}

async function showInfo(player: Player): Promise<void> {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  const familyId = family.id;
  const ownerName = (await findUserNameById(family.ownerId)) ?? "—";
  const members = await countFamilyMembers(familyId);

  if (!hasAdminAccess(player, MIN_LEVEL)) {
    return;
  }

  const live = requireSelected(player);
  if (!live || live.id !== familyId) {
    return;
  }

  const desc = sanitizeChatText(live.description.trim()) || "—";
  const stockStatus = live.isLocked ? "закрыт" : "открыт";
  const body =
    `ID: ${live.id}\n` +
    `Название: ${live.name}\n` +
    `Описание: ${desc}\n` +
    `Уровень: ${live.level}\n` +
    `Опыт: ${live.exp}\n` +
    `Владелец: ${ownerName} (acc #${live.ownerId})\n` +
    `Участников: ${members}\n` +
    `Создана: ${live.createdAt}\n\n` +
    `Склад семьи:\n` +
    `Патроны: ${live.ammo}\n` +
    `Металл: ${live.metal}\n` +
    `Наркотики: ${live.drugs}\n` +
    `Деньги: ${formatMoney(live.money)}\n` +
    `Статус: ${stockStatus}`;

  try {
    Dialog.show(
      player,
      AFAMILY_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      `Семья: ${live.name}`,
      body,
      "Назад",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть информацию.");
  }
}

function showManage(player: Player): void {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  try {
    Dialog.show(
      player,
      AFAMILY_MANAGE_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Управление: ${family.name}`,
      "1. Изменить название\n2. Изменить описание\n3. Удалить семью",
      "Выбрать",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть управление.");
  }
}

function onManagePick(player: Player, listItem: number): void {
  if (!requireSelected(player)) {
    return;
  }

  if (listItem === 0) {
    showRename(player);
    return;
  }

  if (listItem === 1) {
    showRedesc(player);
    return;
  }

  if (listItem === 2) {
    showDeleteConfirm(player);
  }
}

function showRename(player: Player): void {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  try {
    Dialog.show(
      player,
      AFAMILY_RENAME_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Название семьи",
      `Текущее: ${family.name}\n` +
        `Только английские буквы и пробелы.\n` +
        `Длина: ${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX}.`,
      "Сохранить",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть диалог.");
  }
}

function showRedesc(player: Player): void {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  const current = family.description.trim() || "—";
  try {
    Dialog.show(
      player,
      AFAMILY_REDESC_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Описание семьи",
      `Текущее: ${current}\nМаксимум ${FAMILY_DESC_MAX} символов.`,
      "Сохранить",
      "Назад"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть диалог.");
  }
}

function showDeleteConfirm(player: Player): void {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  try {
    Dialog.show(
      player,
      AFAMILY_DELETE_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Удалить семью",
      `Удалить семью «${family.name}» (ID ${family.id})?\n` +
        `Все участники будут исключены, склад и дом семьи сброшены.`,
      "Удалить",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть подтверждение.");
  }
}

async function renameSelected(player: Player, raw: string): Promise<void> {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  const name = normalizeFamilyName(raw);
  if (!name) {
    player.sendClientMessage(
      Color.error,
      `Некорректное название. Только A-Z, a-z и пробелы (${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX}).`
    );
    showRename(player);
    return;
  }

  if (name.toLowerCase() === family.name.toLowerCase()) {
    player.sendClientMessage(Color.info, "Название не изменилось.");
    showManage(player);
    return;
  }

  const exists = await findFamilyByName(name);
  if (!hasAdminAccess(player, MIN_LEVEL)) {
    return;
  }

  if (exists && exists.id !== family.id) {
    player.sendClientMessage(Color.error, "Семья с таким названием уже существует.");
    showRename(player);
    return;
  }

  if (!getFamily(family.id)) {
    player.sendClientMessage(Color.error, "Семья больше не существует.");
    const slot = playerId(player);
    if (slot !== null) {
      selectedFamily.delete(slot);
      showList(player, pageByPlayer.get(slot) ?? 0);
    }
    return;
  }

  const ok = await updateFamilyName(family.id, name);
  if (!hasAdminAccess(player, MIN_LEVEL)) {
    return;
  }

  if (!ok) {
    player.sendClientMessage(Color.error, "Не удалось сохранить название.");
    showManage(player);
    return;
  }

  refreshFamilyTags(family.id);
  player.sendClientMessage(Color.info, `Название семьи изменено на «${name}».`);
  showManage(player);
}

async function redescSelected(player: Player, raw: string): Promise<void> {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  const description = sanitizeChatText(raw.trim()).slice(0, FAMILY_DESC_MAX);
  if (!description) {
    player.sendClientMessage(
      Color.error,
      `Введите описание (до ${FAMILY_DESC_MAX} символов).`
    );
    showRedesc(player);
    return;
  }

  const ok = await updateFamilyDescription(family.id, description);
  if (!hasAdminAccess(player, MIN_LEVEL)) {
    return;
  }

  if (!ok || !getFamily(family.id)) {
    player.sendClientMessage(Color.error, "Не удалось сохранить описание.");
    const slot = playerId(player);
    if (slot !== null && !getFamily(family.id)) {
      selectedFamily.delete(slot);
      showList(player, pageByPlayer.get(slot) ?? 0);
      return;
    }
    showManage(player);
    return;
  }

  player.sendClientMessage(Color.info, "Описание семьи обновлено.");
  showManage(player);
}

async function deleteSelected(player: Player): Promise<void> {
  const family = requireSelected(player);
  if (!family) {
    return;
  }

  const familyId = family.id;
  const familyName = family.name;
  const slot = playerId(player);
  const page = slot !== null ? (pageByPlayer.get(slot) ?? 0) : 0;

  try {
    await deleteFamily(familyId);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось удалить семью.");
    showManage(player);
    return;
  }

  if (!hasAdminAccess(player, MIN_LEVEL)) {
    clearState(player);
    return;
  }

  clearOnlineFamilyMembers(familyId);
  if (slot !== null) {
    selectedFamily.delete(slot);
  }

  player.sendClientMessage(Color.info, `Семья «${familyName}» удалена.`);
  showList(player, page);
}

function clearOnlineFamilyMembers(familyId: number): void {
  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    const account = getAccount(other);
    if (!account || account.familyId !== familyId) {
      return;
    }

    patchAccount(other, { familyId: FAMILY_NONE, familyRank: 0 });
    clearFamilyTag(other);
    try {
      other.sendClientMessage(
        Color.info,
        "Ваша семья была расформирована администрацией."
      );
    } catch {
      // Слот пустой.
    }
  });
}

function clearState(player: Player): void {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  pageByPlayer.delete(slot);
  pageSnapByPlayer.delete(slot);
  selectedFamily.delete(slot);
}
