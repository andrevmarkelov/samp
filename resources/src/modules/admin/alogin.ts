import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, kickSamePlayer, playerId } from "../../shared/player";
import {
  findAdminCredentials,
  saveAdminPassword,
} from "../auth/repository";
import { hashPassword, verifyPassword } from "../auth/password";
import { getAccount, patchAccount } from "../auth/session";
import { passwordError } from "../auth/validation";
import { registerCommand } from "../commands/registry";
import {
  clearAdminSession,
  failAdminLogin,
  isAdminLoggedIn,
  markAdminLoggedIn,
  setPendingAdminPassword,
  takePendingAdminPassword,
} from "./session";

export const ALOGIN_DIALOG_ID = 11;

const DIALOG_STYLE_PASSWORD = 3;
const MAX_LOGIN_ATTEMPTS = 3;

type AloginMode = "login" | "set" | "confirm";

const dialogMode = new Map<number, AloginMode>();

function setMode(player: Player, mode: AloginMode): void {
  const id = playerId(player);
  if (id !== null) {
    dialogMode.set(id, mode);
  }
}

function takeMode(player: Player): AloginMode | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  const mode = dialogMode.get(id) ?? null;
  dialogMode.delete(id);
  return mode;
}

export function clearAloginDialog(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    dialogMode.delete(id);
  }
  clearAdminSession(player);
}

function showPasswordDialog(
  player: Player,
  mode: AloginMode,
  error?: string
): void {
  setMode(player, mode);
  const prefix = error ? `${error}\n\n` : "";
  const title = mode === "login" ? "Админка: вход" : "Админка: пароль";
  const body =
    mode === "login"
      ? `${prefix}Введи пароль от админки:`
      : mode === "set"
        ? `${prefix}Пароль от админки ещё не задан.\nПридумай пароль (от 6 символов):`
        : `${prefix}Повтори пароль от админки:`;

  try {
    Dialog.show(
      player,
      ALOGIN_DIALOG_ID,
      DIALOG_STYLE_PASSWORD,
      title,
      body,
      "OK",
      "Отмена"
    );
  } catch {
    // Игрок уже вышел.
  }
}

export function promptAdminPasswordSetup(player: Player): void {
  showPasswordDialog(player, "set");
}

function kickAfterFails(player: Player): void {
  player.sendClientMessage(
    Color.error,
    "Три неверные попытки входа в админку. Кик."
  );
  kickSamePlayer(player);
}

async function startAlogin(player: Player): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  if (isAdminLoggedIn(player)) {
    player.sendClientMessage(Color.info, "Вы уже авторизованы в админке.");
    return;
  }

  let creds;
  try {
    creds = await findAdminCredentials(account.id);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось проверить админку.");
    return;
  }

  const adminLevel = creds?.adminLevel ?? 0;
  patchAccount(player, { adminLevel });

  if (adminLevel < 1) {
    return;
  }

  if (!creds?.passwordHash) {
    showPasswordDialog(player, "set");
    return;
  }

  showPasswordDialog(player, "login");
}

async function finishSetPassword(
  player: Player,
  password: string
): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  try {
    const hash = await hashPassword(password);
    await saveAdminPassword(account.id, hash);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось сохранить пароль админки.");
    return;
  }

  markAdminLoggedIn(player);
  player.sendClientMessage(
    Color.info,
    `Пароль админки сохранён. Вход выполнен (lvl ${account.adminLevel}).`
  );
}

async function tryLogin(player: Player, password: string): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  let creds;
  try {
    creds = await findAdminCredentials(account.id);
  } catch {
    player.sendClientMessage(Color.error, "Не удалось проверить пароль.");
    return;
  }

  if (!creds?.passwordHash) {
    showPasswordDialog(player, "set");
    return;
  }

  const ok = await verifyPassword(password, creds.passwordHash);
  if (ok) {
    markAdminLoggedIn(player);
    player.sendClientMessage(
      Color.info,
      `Вход в админку выполнен (lvl ${creds.adminLevel}).`
    );
    return;
  }

  const used = failAdminLogin(account.id);
  const left = MAX_LOGIN_ATTEMPTS - used;
  if (left <= 0) {
    kickAfterFails(player);
    return;
  }

  showPasswordDialog(
    player,
    "login",
    `Неверный пароль. Осталось попыток: ${left}`
  );
}

async function handleAloginDialog(
  player: Player,
  ok: boolean,
  raw: string
): Promise<void> {
  const mode = takeMode(player);
  if (!mode) {
    return;
  }

  if (!ok) {
    takePendingAdminPassword(player);
    return;
  }

  const account = getAccount(player);
  if (!account || account.adminLevel < 1) {
    takePendingAdminPassword(player);
    return;
  }

  const input = raw.trim();

  if (mode === "set") {
    const error = passwordError(input);
    if (error) {
      showPasswordDialog(player, "set", error);
      return;
    }

    setPendingAdminPassword(player, input);
    showPasswordDialog(player, "confirm");
    return;
  }

  if (mode === "confirm") {
    const pending = takePendingAdminPassword(player);
    if (!pending) {
      showPasswordDialog(player, "set", "Сначала введи пароль.");
      return;
    }

    if (input !== pending) {
      showPasswordDialog(player, "set", "Пароли не совпадают.");
      return;
    }

    await finishSetPassword(player, pending);
    return;
  }

  if (!input) {
    showPasswordDialog(player, "login", "Введи пароль от админки.");
    return;
  }

  await tryLogin(player, input);
}

export function bindAlogin(): void {
  registerCommand(
    "alogin",
    "Вход в админку",
    (player) => {
      void startAlogin(player);
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, _listItem, inputText) => {
    if (Number(dialogId) !== ALOGIN_DIALOG_ID) {
      return;
    }

    void handleAloginDialog(player, Boolean(response), String(inputText ?? ""));
  });
}
