import type { Player } from "@omp-node/core";
import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_NAME, SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import { isPlayerActive, playerId, playerName } from "../../shared/player";
import { DEFAULT_SPAWN, pickHospitalSpawn, placeAt, writeSpawnInfo } from "../spawn/point";
import { refreshStreamForPlayer } from "../mapping/stream";
import {
  AUTH_DIALOG_ID,
  kickLater,
  prepareAuthView,
  refreshAuthViewSoon,
  showBirthDateDialog,
  showEmailDialog,
  showGenderDialog,
  showLoginDialog,
  showPasswordConfirmDialog,
  showPasswordDialog,
  showRegisterConfirmDialog,
  showRulesDialog,
  showSkinDialog,
} from "./dialogs";
import { hashPassword, verifyPassword } from "./password";
import {
  accountFromRow,
  createUser,
  emailTaken,
  findUserByName,
  isDuplicateKey,
} from "./repository";
import { clearAccount, getAccount, isAuthenticated, setAccount, applyWallet } from "./session";
import { genderLabel, type Gender } from "./gender";
import { skinByIndex } from "./skins";
import {
  emailError,
  formatBirthDate,
  isRoleplayName,
  normalizeEmail,
  parseBirthDate,
  passwordError,
} from "./validation";

const LOGIN_ATTEMPTS = 3;

type RegisterStep =
  | "rules"
  | "email"
  | "password"
  | "passwordConfirm"
  | "birthDate"
  | "gender"
  | "skin"
  | "confirm";

type Pending =
  | { kind: "login"; name: string; attempts: number }
  | {
      kind: "register";
      name: string;
      step: RegisterStep;
      email: string;
      password: string;
      birthDate: string;
      gender: Gender | null;
      skin: number;
      skinLabel: string;
    };

const pending = new Map<number, Pending>();

function pendingOf(player: Player): Pending | undefined {
  const id = playerId(player);
  return id === null ? undefined : pending.get(id);
}

function setPending(player: Player, state: Pending): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  pending.set(id, state);
}

function clearPending(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  pending.delete(id);
}

function isSamePlayer(player: Player, id: number, name?: string): boolean {
  if (!isPlayerActive(player) || playerId(player) !== id) {
    return false;
  }

  return name === undefined || playerName(player) === name;
}

export function spawnIntoWorld(player: Player, skin: number): void {
  const id = playerId(player);
  const account = getAccount(player);
  const spawnPoint = account?.hospitalized ? pickHospitalSpawn() : DEFAULT_SPAWN;

  try {
    writeSpawnInfo(player, skin, spawnPoint);
  } catch {
    // Игрок уже вышел.
  }

  try {
    player.setCameraBehind();
  } catch {
    // Камера выставится на спавне.
  }

  try {
    player.toggleSpectating(false);
  } catch {
    // Спек уже выключен.
  }

  setTimeout(() => {
    if (id === null || !isSamePlayer(player, id) || !isAuthenticated(player)) {
      return;
    }

    try {
      player.setSkin(skin);
      if (!player.isSpawned()) {
        player.spawn();
      }
      if (account?.hospitalized) {
        placeAt(player, spawnPoint);
        refreshStreamForPlayer(player);
      }
      player.setCameraBehind();
    } catch {
      // Спавн уже произошёл при выходе из спека.
    }
  }, 80);
}

function restoreAuthDialog(player: Player, state: Pending): void {
  if (state.kind === "login") {
    showLoginDialog(player, state.name);
    return;
  }

  showRegisterStep(player, state);
}

export function holdAtAuth(player: Player): void {
  try {
    prepareAuthView(player);
  } catch {
    try {
      player.toggleSpectating(true);
    } catch {
      // Слот не готов.
    }
  }

  refreshAuthViewSoon(player);

  const state = pendingOf(player);
  if (!state) {
    return;
  }

  let dialogId = -1;
  try {
    dialogId = Number(player.getDialog());
  } catch {
    dialogId = -1;
  }

  if (dialogId === AUTH_DIALOG_ID) {
    return;
  }

  restoreAuthDialog(player, state);
}

function welcome(player: Player, name: string): void {
  player.sendClientMessage(
    Color.info,
    `Dobro pozhalovat' na ${SERVER_NAME}, ${name}.`
  );
  player.sendClientMessage(
    Color.white,
    `[${SERVER_TAG}] Lokal'nyy chat, /s /w /me /do /try /todo /b. Napishi /help.`
  );
}

function newRegister(name: string): Extract<Pending, { kind: "register" }> {
  return {
    kind: "register",
    name,
    step: "rules",
    email: "",
    password: "",
    birthDate: "",
    gender: null,
    skin: 0,
    skinLabel: "",
  };
}

export async function beginAuth(player: Player, attempt = 0): Promise<void> {
  if (playerId(player) === null) {
    if (attempt >= 4) {
      kickLater(player, "Не удалось начать вход. Перезайди.");
      return;
    }

    setTimeout(() => {
      if (isPlayerActive(player)) {
        void beginAuth(player, attempt + 1);
      }
    }, 200);
    return;
  }

  try {
    prepareAuthView(player);
  } catch {
    try {
      player.toggleSpectating(true);
    } catch {
      // Слот не готов.
    }
  }

  refreshAuthViewSoon(player);

  if (!isDatabaseReady()) {
    kickLater(player, "База данных недоступна. Попробуй позже.");
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const name = playerName(player);
  if (name === "Неизвестный" || !isRoleplayName(name)) {
    kickLater(
      player,
      "Ник должен быть в формате Name_Surname, например John_Doe."
    );
    return;
  }

  try {
    const existing = await findUserByName(name);
    if (!isSamePlayer(player, id, name)) {
      return;
    }

    if (existing) {
      setPending(player, { kind: "login", name, attempts: 0 });
      showLoginDialog(player, name);
      return;
    }

    setPending(player, newRegister(name));
    showRulesDialog(player);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] ошибка входа ${name}: ${message}`);
    if (isPlayerActive(player)) {
      kickLater(player, "Не удалось проверить аккаунт. Попробуй позже.");
    }
  }
}

export function endAuth(player: Player): void {
  clearPending(player);
  clearAccount(player);
}

function showRegisterStep(player: Player, state: Extract<Pending, { kind: "register" }>): void {
  switch (state.step) {
    case "rules":
      showRulesDialog(player);
      break;
    case "email":
      showEmailDialog(player, state.name);
      break;
    case "password":
      showPasswordDialog(player);
      break;
    case "passwordConfirm":
      showPasswordConfirmDialog(player);
      break;
    case "birthDate":
      showBirthDateDialog(player);
      break;
    case "gender":
      showGenderDialog(player);
      break;
    case "skin":
      if (!state.gender) {
        state.step = "gender";
        showGenderDialog(player);
        break;
      }
      showSkinDialog(player, state.gender);
      break;
    case "confirm":
      showRegisterConfirmDialog(
        player,
        `Ник: ${state.name}\nПочта: ${state.email}\nПол: ${state.gender ? genderLabel(state.gender) : "—"}\nДата рождения: ${formatBirthDate(state.birthDate)}\nСкин: ${state.skinLabel} (${state.skin})\n\nЗарегистрировать персонажа?`
      );
      break;
  }
}

function goBack(player: Player, state: Extract<Pending, { kind: "register" }>): void {
  const order: RegisterStep[] = [
    "rules",
    "email",
    "password",
    "passwordConfirm",
    "birthDate",
    "gender",
    "skin",
    "confirm",
  ];
  const index = order.indexOf(state.step);
  if (index <= 0) {
    kickLater(
      player,
      state.step === "rules"
        ? "Ты не принял правила сервера."
        : "Регистрация отменена."
    );
    clearPending(player);
    return;
  }

  state.step = order[index - 1];
  setPending(player, state);
  showRegisterStep(player, state);
}

async function finishLogin(player: Player, name: string, password: string): Promise<void> {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const row = await findUserByName(name);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new Error("bad-password");
  }

  if (!isSamePlayer(player, id, name)) {
    return;
  }

  const account = accountFromRow(row);
  setAccount(player, account);
  clearPending(player);
  spawnIntoWorld(player, account.skin);
  applyWallet(player, account);
  welcome(player, account.name);
  omp.log(`[${SERVER_TAG}] ${account.name} авторизовался`);
}

async function finishRegister(
  player: Player,
  state: Extract<Pending, { kind: "register" }>
): Promise<void> {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  if (await emailTaken(state.email)) {
    if (!isSamePlayer(player, id, state.name)) {
      return;
    }

    state.step = "email";
    setPending(player, state);
    showEmailDialog(player, state.name, "Эта почта уже занята.");
    return;
  }

  if (!isSamePlayer(player, id, state.name)) {
    return;
  }

  if (!state.gender) {
    state.step = "gender";
    setPending(player, state);
    showGenderDialog(player);
    return;
  }

  const passwordHash = await hashPassword(state.password);
  if (!isSamePlayer(player, id, state.name)) {
    return;
  }

  const account = await createUser({
    name: state.name,
    email: state.email,
    passwordHash,
    gender: state.gender,
    skin: state.skin,
    birthDate: state.birthDate,
  });

  if (!isSamePlayer(player, id, state.name)) {
    return;
  }

  setAccount(player, account);
  clearPending(player);
  spawnIntoWorld(player, account.skin);
  applyWallet(player, account);
  welcome(player, account.name);
  player.sendClientMessage(Color.gray, "Personazh sozdan. /help — spisok komand.");
  omp.log(`[${SERVER_TAG}] ${account.name} зарегистрировался`);
}

async function handleLogin(
  player: Player,
  state: Extract<Pending, { kind: "login" }>,
  ok: boolean,
  input: string
): Promise<void> {
  if (!ok) {
    kickLater(player, "Авторизация отменена.");
    clearPending(player);
    return;
  }

  if (!input) {
    showLoginDialog(player, state.name, "Введи пароль.");
    return;
  }

  try {
    await finishLogin(player, state.name, input);
  } catch (error) {
    if (!isPlayerActive(player)) {
      return;
    }

    if (error instanceof Error && error.message === "bad-password") {
      state.attempts += 1;
      if (state.attempts >= LOGIN_ATTEMPTS) {
        kickLater(player, "Слишком много попыток. Перезайди.");
        clearPending(player);
        return;
      }

      setPending(player, state);
      showLoginDialog(
        player,
        state.name,
        `Неверный пароль. Осталось попыток: ${LOGIN_ATTEMPTS - state.attempts}.`
      );
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] ошибка авторизации ${state.name}: ${message}`);
    kickLater(player, "Ошибка авторизации. Попробуй позже.");
    clearPending(player);
  }
}

async function handleRegister(
  player: Player,
  state: Extract<Pending, { kind: "register" }>,
  ok: boolean,
  listItem: number,
  input: string
): Promise<void> {
  if (!ok) {
    goBack(player, state);
    return;
  }

  switch (state.step) {
    case "rules": {
      state.step = "email";
      setPending(player, state);
      showEmailDialog(player, state.name);
      return;
    }

    case "email": {
      const email = normalizeEmail(input);
      const error = emailError(email);
      if (error) {
        showEmailDialog(player, state.name, error);
        return;
      }

      const id = playerId(player);
      if (id === null) {
        return;
      }

      try {
        if (await emailTaken(email)) {
          if (!isSamePlayer(player, id, state.name)) {
            return;
          }
          showEmailDialog(player, state.name, "Эта почта уже занята.");
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] ошибка проверки почты: ${message}`);
        kickLater(player, "Не удалось проверить почту. Попробуй позже.");
        clearPending(player);
        return;
      }

      if (!isSamePlayer(player, id, state.name)) {
        return;
      }

      state.email = email;
      state.step = "password";
      setPending(player, state);
      showPasswordDialog(player);
      return;
    }

    case "password": {
      const error = passwordError(input);
      if (error) {
        showPasswordDialog(player, error);
        return;
      }

      state.password = input;
      state.step = "passwordConfirm";
      setPending(player, state);
      showPasswordConfirmDialog(player);
      return;
    }

    case "passwordConfirm": {
      if (input !== state.password) {
        showPasswordConfirmDialog(player, "Пароли не совпадают.");
        return;
      }

      state.step = "birthDate";
      setPending(player, state);
      showBirthDateDialog(player);
      return;
    }

    case "birthDate": {
      const parsed = parseBirthDate(input);
      if ("error" in parsed) {
        showBirthDateDialog(player, parsed.error);
        return;
      }

      state.birthDate = parsed.iso;
      state.step = "gender";
      setPending(player, state);
      showGenderDialog(player);
      return;
    }

    case "gender": {
      const gender: Gender | null = listItem === 0 ? "male" : listItem === 1 ? "female" : null;
      if (!gender) {
        showGenderDialog(player);
        return;
      }

      state.gender = gender;
      state.step = "skin";
      setPending(player, state);
      showSkinDialog(player, gender);
      return;
    }

    case "skin": {
      if (!state.gender) {
        state.step = "gender";
        setPending(player, state);
        showGenderDialog(player);
        return;
      }

      const skin = skinByIndex(state.gender, listItem);
      if (!skin) {
        showSkinDialog(player, state.gender);
        return;
      }

      state.skin = skin.id;
      state.skinLabel = skin.label;
      state.step = "confirm";
      setPending(player, state);
      showRegisterStep(player, state);
      return;
    }

    case "confirm": {
      try {
        await finishRegister(player, state);
      } catch (error) {
        if (!isPlayerActive(player)) {
          return;
        }

        if (isDuplicateKey(error)) {
          state.step = "email";
          setPending(player, state);
          showEmailDialog(player, state.name, "Эта почта или ник уже заняты.");
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] ошибка регистрации ${state.name}: ${message}`);
        kickLater(player, "Не удалось создать персонажа. Попробуй позже.");
        clearPending(player);
      }
    }
  }
}

export async function handleAuthDialog(
  player: Player,
  response: number,
  listItem: number,
  inputText: string
): Promise<void> {
  const state = pendingOf(player);
  if (!state) {
    return;
  }

  const ok = response !== 0;
  if (state.kind === "login") {
    await handleLogin(player, state, ok, inputText);
    return;
  }

  await handleRegister(player, state, ok, listItem, inputText);
}
