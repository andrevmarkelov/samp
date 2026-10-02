import { Dialog, type Player } from "@omp-node/core";
import { SERVER_NAME } from "../../shared/brand";
import { Color } from "../../shared/colors";
import { isPlayerActive, kickSamePlayer } from "../../shared/player";
import { DEFAULT_SPAWN, STREET_WORLD } from "../spawn/point";
import { GENDER_LIST_FEMALE, GENDER_LIST_MALE, type Gender } from "./gender";
import { RULES_TITLE, SERVER_RULES } from "./rules";
import { isAuthenticated } from "./session";
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
  player.setInterior(0);
  player.setVirtualWorld(STREET_WORLD);
  player.setPos(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z);
  player.toggleSpectating(true);
  player.setCameraPos(1779.37, -1932.56, 22.0);
  player.setCameraLookAt(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z, 2);
}

export function refreshAuthViewSoon(player: Player): void {
  for (const delay of [80, 400]) {
    setTimeout(() => {
      if (!isPlayerActive(player) || isAuthenticated(player)) {
        return;
      }

      try {
        prepareAuthView(player);
      } catch {
        // Слот ещё не готов.
      }
    }, delay);
  }
}

export function kickLater(player: Player, reason: string): void {
  player.sendClientMessage(Color.error, reason);
  kickSamePlayer(player);
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
  const prefix = error ? `{FF6347}${error}{FFFFFF}\n\n` : "";
  const body = [
    prefix + `Добро пожаловать на сервер ${SERVER_NAME}`,
    "Ваш ник зарегистрирован.",
    "",
    `Логин: {33FF33}${name}{FFFFFF}`,
    "",
    "Введите пароль:",
  ].join("\n");

  showAuthDialog(
    player,
    DialogStyle.password,
    "Авторизация",
    body,
    "Войти",
    "Выход"
  );
}

export function showEmailDialog(player: Player, name: string, error?: string): void {
  const prefix = error ? `{FF6347}${error}{FFFFFF}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Регистрация",
    `${prefix}Ник {33FF33}${name}{FFFFFF} свободен.\nВведите почту:`,
    "Далее",
    "Назад"
  );
}

export function showPasswordDialog(player: Player, error?: string): void {
  const prefix = error ? `{FF6347}${error}{FFFFFF}\n\n` : "";
  const body = [
    prefix + `Добро пожаловать на сервер ${SERVER_NAME}`,
    "Чтобы начать игру, вам необходимо пройти регистрацию.",
    "",
    "Введите пароль для вашего аккаунта.",
    "Он будет запрашиваться каждый раз, когда вы заходите на сервер.",
    "",
    "{33FF33}Примечания:",
    "- Пароль может состоять из русских и латинских символов",
    "- Пароль чувствителен к регистру",
    "- Пароль не должен содержать пробелы",
    "- Длина пароля от 6 до 32 символов",
  ].join("\n");

  showAuthDialog(
    player,
    DialogStyle.password,
    "Регистрация",
    body,
    "Далее",
    "Назад"
  );
}

export function showPasswordConfirmDialog(player: Player, error?: string): void {
  const prefix = error ? `{FF6347}${error}{FFFFFF}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.password,
    "Регистрация",
    `${prefix}Повторите пароль:`,
    "Далее",
    "Назад"
  );
}

export function showBirthDateDialog(player: Player, error?: string): void {
  const prefix = error ? `{FF6347}${error}{FFFFFF}\n\n` : "";
  showAuthDialog(
    player,
    DialogStyle.input,
    "Регистрация",
    `${prefix}Дата рождения (DD.MM.YYYY):\nНапример 15.04.1998`,
    "Далее",
    "Назад"
  );
}

export function showGenderDialog(player: Player): void {
  showAuthDialog(
    player,
    DialogStyle.list,
    "Пол персонажа",
    `${GENDER_LIST_MALE}\n${GENDER_LIST_FEMALE}`,
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
