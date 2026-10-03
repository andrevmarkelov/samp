import { Dialog, omp, type Player } from "@omp-node/core";
import { Color, chatColorTag } from "../../shared/colors";
import { clipClientMessage, sanitizeChatText } from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId } from "../../shared/player";
import { saveUserFamily } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { normalizeFamilyName } from "./create-office";
import { getFamily } from "./catalog";
import { getFamilyMembership, isFamilyOwner } from "./membership";
import {
  countFamilyMembers,
  deleteFamily,
  findFamilyByName,
  findUserNameById,
  transferFamilyOwnershipWithRanks,
  tryDeleteFamilyIfSoleMember,
  updateFamilyDescription,
  updateFamilyName,
} from "./repository";
import { clearFamilyTag, refreshFamilyTags, syncFamilyTag } from "./tags";
import {
  FAMILY_DESC_MAX,
  FAMILY_MANAGE_MAX_RANK,
  FAMILY_NAME_MAX,
  FAMILY_NAME_MIN,
  FAMILY_NONE,
  FAMILY_STAFF_MIN_RANK,
  MAX_FAMILY_RANK,
} from "./types";

export const FAMILY_MENU_DIALOG_ID = 115;
export const FAMILY_INFO_DIALOG_ID = 116;
export const FAMILY_MANAGE_DIALOG_ID = 117;
export const FAMILY_LEAVE_CONFIRM_DIALOG_ID = 118;
export const FAMILY_RENAME_DIALOG_ID = 119;
export const FAMILY_REDESC_DIALOG_ID = 120;
export const FAMILY_DELETE_CONFIRM_DIALOG_ID = 121;
export const FAMILY_TRANSFER_DIALOG_ID = 122;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_LIST = 2;

registerCommand("family", "Меню семьи", (player) => {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  showMainMenu(player);
});

export function bindFamilyMenu(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    if (
      id !== FAMILY_MENU_DIALOG_ID &&
      id !== FAMILY_INFO_DIALOG_ID &&
      id !== FAMILY_MANAGE_DIALOG_ID &&
      id !== FAMILY_LEAVE_CONFIRM_DIALOG_ID &&
      id !== FAMILY_RENAME_DIALOG_ID &&
      id !== FAMILY_REDESC_DIALOG_ID &&
      id !== FAMILY_DELETE_CONFIRM_DIALOG_ID &&
      id !== FAMILY_TRANSFER_DIALOG_ID
    ) {
      return;
    }

    const accepted = Number(response) !== 0;

    if (id === FAMILY_MENU_DIALOG_ID) {
      if (!accepted) {
        return;
      }
      onMainPick(player, Number(listItem));
      return;
    }

    if (id === FAMILY_INFO_DIALOG_ID) {
      if (accepted) {
        showMainMenu(player);
      }
      return;
    }

    if (id === FAMILY_MANAGE_DIALOG_ID) {
      if (!accepted) {
        showMainMenu(player);
        return;
      }
      onManagePick(player, Number(listItem));
      return;
    }

    if (id === FAMILY_LEAVE_CONFIRM_DIALOG_ID) {
      if (!accepted) {
        showMainMenu(player);
        return;
      }
      void leaveFamily(player);
      return;
    }

    if (id === FAMILY_RENAME_DIALOG_ID) {
      if (!accepted) {
        showManageMenu(player);
        return;
      }
      void renameFamily(player, String(inputText ?? ""));
      return;
    }

    if (id === FAMILY_REDESC_DIALOG_ID) {
      if (!accepted) {
        showManageMenu(player);
        return;
      }
      void redesFamily(player, String(inputText ?? ""));
      return;
    }

    if (id === FAMILY_TRANSFER_DIALOG_ID) {
      if (!accepted) {
        showManageMenu(player);
        return;
      }
      void transferFamilyRights(player, String(inputText ?? ""));
      return;
    }

    if (id === FAMILY_DELETE_CONFIRM_DIALOG_ID) {
      if (!accepted) {
        showManageMenu(player);
        return;
      }
      void dissolveFamily(player);
    }
  });
}

function showMainMenu(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  const lines = ["Информация", "Управление семьей", "Покинуть семью"];

  try {
    Dialog.show(
      player,
      FAMILY_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      `Семья: ${membership.family.name}`,
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть меню.");
  }
}

function onMainPick(player: Player, listItem: number): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  if (listItem === 0) {
    void showInfo(player);
    return;
  }

  if (listItem === 1) {
    if (membership.rank.id < FAMILY_STAFF_MIN_RANK) {
      tell(player, Color.error, "Управление доступно с 9 ранга.");
      showMainMenu(player);
      return;
    }
    showManageMenu(player);
    return;
  }

  if (listItem === 2) {
    showLeaveConfirm(player);
  }
}

async function showInfo(player: Player): Promise<void> {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  const family = membership.family;
  const ownerName = (await findUserNameById(family.ownerId)) ?? "—";
  const members = await countFamilyMembers(family.id);
  const desc = family.description.trim() || "—";

  const body =
    `Название: ${family.name}\n` +
    `Описание: ${desc}\n` +
    `Уровень: ${family.level}\n` +
    `Опыт: ${family.exp}\n` +
    `Владелец: ${ownerName}\n` +
    `Участников: ${members}\n` +
    `Ваш ранг: ${membership.rank.title} (${membership.rank.id})`;

  try {
    Dialog.show(
      player,
      FAMILY_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Информация о семье",
      body,
      "Назад",
      "Закрыть"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть информацию.");
  }
}

function showManageMenu(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || membership.rank.id < FAMILY_STAFF_MIN_RANK) {
    tell(player, Color.error, "Управление доступно с 9 ранга.");
    return;
  }

  const lines = [
    "Изменить название",
    "Изменить описание",
    "Передать права семьи",
    "Удалить семью",
  ];

  try {
    Dialog.show(
      player,
      FAMILY_MANAGE_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Управление семьей",
      lines.join("\n"),
      "Выбрать",
      "Назад"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть управление.");
  }
}

function onManagePick(player: Player, listItem: number): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || membership.rank.id < FAMILY_STAFF_MIN_RANK) {
    tell(player, Color.error, "Управление доступно с 9 ранга.");
    return;
  }

  if (listItem === 0) {
    showRenameDialog(player);
    return;
  }

  if (listItem === 1) {
    showRedescDialog(player);
    return;
  }

  if (listItem === 2) {
    if (!isFamilyOwner(account)) {
      tell(player, Color.error, "Передать права может только владелец.");
      showManageMenu(player);
      return;
    }
    showTransferDialog(player);
    return;
  }

  if (listItem === 3) {
    if (!isFamilyOwner(account)) {
      tell(player, Color.error, "Удалить семью может только владелец.");
      showManageMenu(player);
      return;
    }
    showDeleteConfirm(player);
  }
}

function showLeaveConfirm(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership) {
    return;
  }

  const isOwner = membership.family.ownerId === account.id;
  const body = isOwner
    ? `Вы владелец семьи «${membership.family.name}».\n` +
      `Если вы единственный участник — семья будет расформирована.\n` +
      `Если есть другие — сначала передайте права:\n` +
      `/family → Управление → Передать права семьи.\n\n` +
      `Покинуть семью?`
    : `Покинуть семью «${membership.family.name}»?`;

  try {
    Dialog.show(
      player,
      FAMILY_LEAVE_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Покинуть семью",
      body,
      "Да",
      "Нет"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть подтверждение.");
  }
}

function showRenameDialog(player: Player): void {
  const membership = getAccount(player)
    ? getFamilyMembership(getAccount(player)!)
    : null;
  if (!membership) {
    return;
  }

  try {
    Dialog.show(
      player,
      FAMILY_RENAME_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Название семьи",
      `Текущее: ${membership.family.name}\n` +
        `Только английские буквы и пробелы.\n` +
        `Длина: ${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX}.\n` +
        `Пример: Woozie Family`,
      "Сохранить",
      "Назад"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть диалог.");
  }
}

function showRedescDialog(player: Player): void {
  const membership = getAccount(player)
    ? getFamilyMembership(getAccount(player)!)
    : null;
  if (!membership) {
    return;
  }

  const current = membership.family.description.trim() || "—";
  try {
    Dialog.show(
      player,
      FAMILY_REDESC_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Описание семьи",
      `Текущее: ${current}\nМаксимум ${FAMILY_DESC_MAX} символов.`,
      "Сохранить",
      "Назад"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть диалог.");
  }
}

function showTransferDialog(player: Player): void {
  const account = getAccount(player);
  if (!account || !isFamilyOwner(account)) {
    return;
  }

  try {
    Dialog.show(
      player,
      FAMILY_TRANSFER_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Передать права семьи",
      "Введите ID игрока (должен быть в сети и в вашей семье).\n" +
        "Вы станете заместителем (9 ранг).",
      "Передать",
      "Назад"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть диалог.");
  }
}

function showDeleteConfirm(player: Player): void {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || !isFamilyOwner(account)) {
    return;
  }

  try {
    Dialog.show(
      player,
      FAMILY_DELETE_CONFIRM_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Удалить семью",
      `Семья «${membership.family.name}» будет удалена.\n` +
        `Все участники будут исключены.\n\n` +
        `Подтвердить удаление?`,
      "Удалить",
      "Отмена"
    );
  } catch {
    tell(player, Color.error, "Не удалось открыть подтверждение.");
  }
}

async function transferFamilyRights(player: Player, rawId: string): Promise<void> {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || !isFamilyOwner(account)) {
    tell(player, Color.error, "Передать права может только владелец.");
    return;
  }

  const slot = Math.floor(Number(String(rawId).trim()));
  if (!Number.isInteger(slot) || slot < 0) {
    tell(player, Color.error, "Введите корректный ID игрока.");
    showTransferDialog(player);
    return;
  }

  const target = omp.players.at(slot);
  if (!target || !isPlayerActive(target)) {
    tell(player, Color.error, "Игрок не в сети.");
    showTransferDialog(player);
    return;
  }

  try {
    if (target.isNPC()) {
      tell(player, Color.error, "Игрок не найден.");
      showTransferDialog(player);
      return;
    }
  } catch {
    tell(player, Color.error, "Игрок не найден.");
    showTransferDialog(player);
    return;
  }

  const selfId = playerId(player);
  const targetId = playerId(target);
  if (selfId !== null && selfId === targetId) {
    tell(player, Color.error, "Нельзя передать права себе.");
    showTransferDialog(player);
    return;
  }

  const targetAccount = getAccount(target);
  const targetFamily = targetAccount ? getFamilyMembership(targetAccount) : null;
  if (
    !targetAccount ||
    !targetFamily ||
    targetFamily.family.id !== membership.family.id
  ) {
    tell(player, Color.error, "Игрок должен быть в вашей семье и в сети.");
    showTransferDialog(player);
    return;
  }

  const familyId = membership.family.id;

  const transferred = await transferFamilyOwnershipWithRanks(
    familyId,
    account.id,
    targetAccount.id,
    FAMILY_MANAGE_MAX_RANK,
    MAX_FAMILY_RANK
  );
  if (!transferred) {
    tell(player, Color.error, "Не удалось передать права.");
    showManageMenu(player);
    return;
  }

  if (isPlayerActive(player) && getAccount(player)?.id === account.id) {
    patchAccount(player, { familyId, familyRank: FAMILY_MANAGE_MAX_RANK });
    syncFamilyTag(player);
  }

  if (isPlayerActive(target) && getAccount(target)?.id === targetAccount.id) {
    patchAccount(target, { familyId, familyRank: MAX_FAMILY_RANK });
    syncFamilyTag(target);
  }

  const familyName = getFamily(familyId)?.name ?? membership.family.name;
  const targetTag = playerChatName(target);

  tell(player, Color.info, `Вы передали права семьи «${familyName}» игроку ${targetTag}.`);
  tell(player, Color.info, "Ваш новый ранг: Заместитель (9).");
  tell(target, Color.info, `Вы стали владельцем семьи «${familyName}».`);

  broadcastFamilyNotice(
    familyId,
    familyName,
    player,
    `передал права семьи ${targetTag}`
  );
  showManageMenu(player);
}

function broadcastFamilyNotice(
  familyId: number,
  familyName: string,
  actor: Player,
  message: string
): void {
  const membership = getAccount(actor) ? getFamilyMembership(getAccount(actor)!) : null;
  const rankId = membership?.rank.id ?? 0;
  const rankTitle = membership?.rank.title ?? "—";

  const line = clipClientMessage(
    `[Семья] [${familyName}] [${rankId}] ${rankTitle} ${playerChatName(actor)}${chatColorTag(Color.white)}: ${message}`
  );

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    const otherAccount = getAccount(other);
    if (!otherAccount || otherAccount.familyId !== familyId) {
      return;
    }

    try {
      other.sendClientMessage(Color.familyChat, line);
    } catch {
      // Слот пустой.
    }
  });
}

async function renameFamily(player: Player, raw: string): Promise<void> {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || membership.rank.id < FAMILY_STAFF_MIN_RANK) {
    tell(player, Color.error, "Управление доступно с 9 ранга.");
    return;
  }

  const name = normalizeFamilyName(raw);
  if (!name) {
    tell(
      player,
      Color.error,
      `Некорректное название. Только A-Z, a-z и пробелы (${FAMILY_NAME_MIN}-${FAMILY_NAME_MAX}).`
    );
    showRenameDialog(player);
    return;
  }

  if (name.toLowerCase() === membership.family.name.toLowerCase()) {
    tell(player, Color.info, "Название не изменилось.");
    showManageMenu(player);
    return;
  }

  const exists = await findFamilyByName(name);
  if (exists && exists.id !== membership.family.id) {
    tell(player, Color.error, "Семья с таким названием уже существует.");
    showRenameDialog(player);
    return;
  }

  const ok = await updateFamilyName(membership.family.id, name);
  if (!ok) {
    tell(player, Color.error, "Не удалось сохранить название.");
    showManageMenu(player);
    return;
  }

  refreshFamilyTags(membership.family.id);
  tell(player, Color.info, `Название семьи изменено на «${name}».`);
  showManageMenu(player);
}

async function redesFamily(player: Player, raw: string): Promise<void> {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || membership.rank.id < FAMILY_STAFF_MIN_RANK) {
    tell(player, Color.error, "Управление доступно с 9 ранга.");
    return;
  }

  const description = sanitizeChatText(raw.trim()).slice(0, FAMILY_DESC_MAX);
  if (!description) {
    tell(player, Color.error, `Введите описание (до ${FAMILY_DESC_MAX} символов).`);
    showRedescDialog(player);
    return;
  }

  const ok = await updateFamilyDescription(membership.family.id, description);
  if (!ok) {
    tell(player, Color.error, "Не удалось сохранить описание.");
    showManageMenu(player);
    return;
  }

  tell(player, Color.info, "Описание семьи обновлено.");
  showManageMenu(player);
}

async function leaveFamily(player: Player): Promise<void> {
  const live = getAccount(player);
  const liveMembership = live ? getFamilyMembership(live) : null;
  if (!live || !liveMembership) {
    tell(player, Color.error, "Вы не состоите в семье.");
    return;
  }

  const familyId = liveMembership.family.id;
  const isOwner = liveMembership.family.ownerId === live.id;

  if (isOwner) {
    const dissolved = await tryDeleteFamilyIfSoleMember(familyId, live.id);
    if (!dissolved) {
      tell(
        player,
        Color.error,
        "Сначала передайте права: /family → Управление → Передать права семьи."
      );
      return;
    }

    clearOnlineFamilyMembers(familyId);
    if (isPlayerActive(player) && getAccount(player)?.id === live.id) {
      patchAccount(player, { familyId: FAMILY_NONE, familyRank: 0 });
      clearFamilyTag(player);
      tell(player, Color.info, "Семья расформирована.");
    }
    return;
  }

  try {
    await saveUserFamily(live.id, FAMILY_NONE, 0);
  } catch {
    tell(player, Color.error, "Не удалось сохранить в базу.");
    return;
  }

  if (!isPlayerActive(player) || getAccount(player)?.id !== live.id) {
    return;
  }

  patchAccount(player, { familyId: FAMILY_NONE, familyRank: 0 });
  clearFamilyTag(player);
  tell(player, Color.info, `Вы покинули семью ${liveMembership.family.name}.`);
}

async function dissolveFamily(player: Player): Promise<void> {
  const account = getAccount(player);
  const membership = account ? getFamilyMembership(account) : null;
  if (!account || !membership || !isFamilyOwner(account)) {
    tell(player, Color.error, "Удалить семью может только владелец.");
    return;
  }

  const familyId = membership.family.id;
  const familyName = membership.family.name;

  try {
    await deleteFamily(familyId);
  } catch {
    tell(player, Color.error, "Не удалось удалить семью.");
    return;
  }

  clearOnlineFamilyMembers(familyId);
  if (getAccount(player)?.id === account.id) {
    patchAccount(player, { familyId: FAMILY_NONE, familyRank: 0 });
    clearFamilyTag(player);
  }

  tell(player, Color.info, `Семья «${familyName}» удалена.`);
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
    tell(other, Color.info, "Ваша семья была расформирована.");
  });
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (isPlayerActive(player)) {
      player.sendClientMessage(color, text);
    }
  } catch {
    // Слот пустой.
  }
}
