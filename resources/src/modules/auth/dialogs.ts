import { Dialog, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive } from "../../shared/player";
import type { Gender } from "./gender";
import { RULES_TITLE, SERVER_RULES } from "./rules";
import { skinListBody } from "./skins";

export const AUTH_DIALOG_ID = 1;

export const DialogStyle = {
  msgbox: 0,
  input: 1,
  list: 2,
  password: 3,
} as const;

export function showAuthDialog(
  player: Player,
  style: number,
  title: string,
  body: string,
  button1: string,
  button2: string
): void {
  try {
    Dialog.show(player, AUTH_DIALOG_ID, style, title, body, button1, button2);
  } catch {
    // Игрок уже вышел.
  }
}

export function prepareAuthView(player: Player): void {
  player.toggleSpectating(true);
  player.setCameraPos(2476.0, -1665.0, 22.0);
  player.setCameraLookAt(2495.35, -1688.23, 13.67, 2);
}

export function kickLater(player: Player, reason: string): void {
  player.sendClientMessage(Color.error, reason);
  setTimeout(() => {
    if (!isPlayerActive(player)) {
      return;
    }

    try {
      player.kick();
    } catch {
      // Уже вышел.
    }
  }, 120);
}

export function showRulesDialog(player: Player): void {
  showAuthDialog(
    player,
    DialogStyle.msgbox,
    RULES_TITLE,
    SERVER_RULES,
    "Принимаю",
    "Отказаться"
  );
}

export function showLoginDialog(player: Player, name: string, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Авторизация",
    `${prefix}Ник ${name} уже зарегистрирован.\nВведи пароль:`,
    "Войти",
    "Выход"
  );
}

export function showEmailDialog(player: Player, name: string, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Регистрация",
    `${prefix}Ник ${name} свободен.\nВведи почту:`,
    "Далее",
    "Назад"
  );
}

export function showPasswordDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Регистрация",
    `${prefix}Придумай пароль (от 6 символов):`,
    "Далее",
    "Назад"
  );
}

export function showPasswordConfirmDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Регистрация",
    `${prefix}Повтори пароль:`,
    "Далее",
    "Назад"
  );
}

export function showBirthDateDialog(player: Player, error?: string): void {
  const prefix = error ? `${error}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Регистрация",
    `${prefix}Дата рождения (ДД.ММ.ГГГГ):\nНапример 15.04.1998`,
    "Далее",
    "Назад"
  );
}

export function showGenderDialog(player: Player): void {
  showAuthDialog(
    player,
    DialogStyle.list,
    "Регистрация",
    "Мужской\nЖенский",
    "Выбрать",
    "Назад"
  );
}

export function showSkinDialog(player: Player, gender: Gender): void {
  showAuthDialog(
    player,
    DialogStyle.list,
    "Выбор скина",
    skinListBody(gender),
    "Выбрать",
    "Назад"
  );
}

export function showRegisterConfirmDialog(player: Player, body: string): void {
  showAuthDialog(
    player,
    DialogStyle.msgbox,
    "Подтверждение",
    body,
    "Готово",
    "Назад"
  );
}
