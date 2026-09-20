import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import { RULES_TITLE, SERVER_RULES } from "../auth/rules";
import { findUserByName, saveUserInvitedBy } from "../auth/repository";
import { getAccount, patchAccount } from "../auth/session";
import { isRoleplayName } from "../auth/validation";
import { registerCommand } from "./registry";
import { showReportDialog } from "./report";
import { showStatsDialog } from "./stats";

export const MENU_DIALOG_ID = 4;
export const RULES_DIALOG_ID = 5;
export const INVITE_DIALOG_ID = 6;

const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_INPUT = 1;
const DIALOG_STYLE_LIST = 2;

type MenuKey = "stats" | "rules" | "report" | "invite";

const MENU_ITEMS: Record<MenuKey, string> = {
  stats: "Статистика",
  rules: "Правила сервера",
  report: "Связь с администрацией",
  invite: "Кто пригласил",
};

registerCommand("mn", "Меню: статистика, правила и связь с администрацией", (player) => {
  showMenu(player);
});

export function bindMenuDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    const id = Number(dialogId);
    const ok = Number(response) !== 0;
    const input = String(inputText ?? "");

    if (id === MENU_DIALOG_ID) {
      if (!ok) {
        return;
      }

      const item = menuItem(player, Number(listItem), input);
      if (item === "stats") {
        showStatsDialog(player);
        return;
      }

      if (item === "rules") {
        showRulesDialog(player);
        return;
      }

      if (item === "invite") {
        showInviteDialog(player);
        return;
      }

      if (item === "report") {
        showReportDialog(player);
      }
      return;
    }

    if (id === INVITE_DIALOG_ID) {
      if (!ok) {
        return;
      }

      void submitInvite(player, input);
    }
  });
}

function visibleMenuKeys(player: Player): MenuKey[] {
  const keys: MenuKey[] = ["stats", "rules", "report"];
  const account = getAccount(player);
  if (account && !account.invitedBy) {
    keys.push("invite");
  }

  return keys;
}

function showMenu(player: Player): void {
  const body = visibleMenuKeys(player)
    .map((key) => MENU_ITEMS[key])
    .join("\n");

  try {
    Dialog.show(
      player,
      MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Меню",
      body,
      "Выбрать",
      "Закрыть"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть меню.");
  }
}

function showRulesDialog(player: Player): void {
  try {
    Dialog.show(
      player,
      RULES_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      RULES_TITLE,
      SERVER_RULES,
      "Закрыть",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть правила.");
  }
}

function showInviteDialog(player: Player, error?: string): void {
  const account = getAccount(player);
  if (!account || account.invitedBy) {
    return;
  }

  const prefix = error ? `${error}\n\n` : "";
  try {
    Dialog.show(
      player,
      INVITE_DIALOG_ID,
      DIALOG_STYLE_INPUT,
      "Кто пригласил",
      `${prefix}Введи ник игрока, который тебя пригласил.\nФормат: Name_Surname`,
      "Сохранить",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть форму.");
  }
}

function menuItem(player: Player, listItem: number, inputText: string): MenuKey | null {
  const keys = visibleMenuKeys(player);
  const raw = inputText.trim().toLowerCase();

  for (const key of keys) {
    if (raw === MENU_ITEMS[key].toLowerCase()) {
      return key;
    }
  }

  return keys[listItem] ?? null;
}

async function submitInvite(player: Player, raw: string): Promise<void> {
  const account = getAccount(player);
  if (!account || !isPlayerActive(player)) {
    return;
  }

  if (account.invitedBy) {
    player.sendClientMessage(Color.gray, "Пригласивший уже указан.");
    return;
  }

  const nick = raw.trim();
  if (!nick) {
    showInviteDialog(player, "Введи ник.");
    return;
  }

  if (!isRoleplayName(nick)) {
    showInviteDialog(player, "Ник в формате Name_Surname.");
    return;
  }

  if (nick.toLowerCase() === account.name.toLowerCase()) {
    showInviteDialog(player, "Нельзя указать себя.");
    return;
  }

  try {
    const row = await findUserByName(nick);
    if (!isPlayerActive(player)) {
      return;
    }

    const live = getAccount(player);
    if (!live || live.invitedBy) {
      return;
    }

    if (!row) {
      showInviteDialog(player, "Такой ник не зарегистрирован.");
      return;
    }

    const saved = await saveUserInvitedBy(live.id, row.name);
    if (!isPlayerActive(player)) {
      return;
    }

    if (!saved) {
      player.sendClientMessage(Color.gray, "Пригласивший уже указан.");
      return;
    }

    patchAccount(player, { invitedBy: row.name });
    player.sendClientMessage(
      Color.info,
      `Пригласивший сохранён: ${row.name}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] ошибка рефералки ${account.name}: ${message}`);
    if (isPlayerActive(player)) {
      player.sendClientMessage(
        Color.error,
        "Не удалось сохранить. Попробуй позже."
      );
    }
  }
}
