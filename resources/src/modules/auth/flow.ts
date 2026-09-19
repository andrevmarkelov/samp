import type { Player } from "@omp-node/core";
import { omp } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_NAME, SERVER_TAG } from "../../shared/brand";
import { isDatabaseReady } from "../../shared/database";
import { isPlayerActive, playerId, playerIp, playerName } from "../../shared/player";
import { DEFAULT_SPAWN, pickHospitalSpawn, placeAt, writeSpawnInfo } from "../spawn/point";
import { applyOrgVisuals, resolveOrgSpawn, resolvePlayerSkin } from "../org";
import { isJailedAccount, pickJailCell } from "../prison/sentence";
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
  saveUserLastIp,
} from "./repository";
import { clearAccount, getAccount, isAuthenticated, setAccount, applyWallet, applyScore } from "./session";
import { genderFromList, genderLabel, type Gender } from "./gender";
import {
  closeSkinPicker,
  cycleSkin,
  isSkinPicking,
  openSkinPicker,
  pauseSkinPicker,
  resumeSkinPreview,
  selectedSkin,
} from "./skin-picker";
import { hasSkin, skinByIndex } from "./skins";
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
  const useSkin = account ? resolvePlayerSkin(account) : skin;
  const spawnPoint = resolveWorldSpawn(account);

  try {
    writeSpawnInfo(player, useSkin, spawnPoint);
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

  try {
    player.toggleControllable(true);
  } catch {
    // Управление включится на спавне.
  }

  closeSkinPicker(player);

  setTimeout(() => {
    if (id === null || !isSamePlayer(player, id) || !isAuthenticated(player)) {
      return;
    }

    try {
      applyOrgVisuals(player);
      if (!player.isSpawned()) {
        player.spawn();
      }
      placeAt(player, resolveWorldSpawn(getAccount(player)));
      refreshStreamForPlayer(player);
      player.setCameraBehind();
    } catch {
      // Спавн уже произошёл при выходе из спека.
    }
  }, 80);
}

function resolveWorldSpawn(account: ReturnType<typeof getAccount>): typeof DEFAULT_SPAWN {
  if (account && isJailedAccount(account)) {
    return pickJailCell();
  }

  if (account?.hospitalized) {
    return pickHospitalSpawn();
  }

  return resolveOrgSpawn(account) ?? DEFAULT_SPAWN;
}

function restoreAuthDialog(player: Player, state: Pending): void {
  if (state.kind === "login") {
    showLoginDialog(player, state.name);
    return;
  }

  showRegisterStep(player, state);
}

export function holdAtAuth(player: Player): void {
  const state = pendingOf(player);
  if (state?.kind === "register" && state.gender) {
    if (state.step === "skin") {
      const skin = openSkinPicker(player, state.gender, state.skin);
      if (skin) {
        return;
      }
      showSkinDialog(player, state.gender);
    } else if (state.step === "confirm" && resumeSkinPreview(player, state.gender, state.skin)) {
      return;
    }
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
      kickLater(player, "Ne udalos' nachat' vhod. Perezaydi.");
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
    kickLater(player, "Baza dannykh nedostupna. Poprobuy pozhe.");
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
      "Nik dolzhen byt' v formate Name_Surname, naprimer John_Doe."
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
      kickLater(player, "Ne udalos' proverit' akkaunt. Poprobuy pozhe.");
    }
  }
}

export function endAuth(player: Player): void {
  closeSkinPicker(player);
  clearPending(player);
  clearAccount(player);
}

function showSkinPicker(
  player: Player,
  state: Extract<Pending, { kind: "register" }>
): void {
  if (!state.gender) {
    state.step = "gender";
    setPending(player, state);
    showGenderDialog(player);
    return;
  }

  const skin = openSkinPicker(player, state.gender, state.skin);
  if (!skin) {
    showSkinDialog(player, state.gender);
    return;
  }

  state.skin = skin.id;
  state.skinLabel = skin.label;
  setPending(player, state);
}

export function handleSkinPickerAction(
  player: Player,
  action: "prev" | "next" | "select" | "cancel"
): void {
  const state = pendingOf(player);
  if (!state || state.kind !== "register" || state.step !== "skin" || !state.gender) {
    return;
  }

  if (action === "cancel") {
    goBack(player, state);
    return;
  }

  if (action === "prev" || action === "next") {
    const skin = cycleSkin(player, action === "next" ? 1 : -1);
    if (!skin) {
      return;
    }
    state.skin = skin.id;
    state.skinLabel = skin.label;
    setPending(player, state);
    return;
  }

  const skin = selectedSkin(player);
  if (!skin) {
    showSkinPicker(player, state);
    return;
  }

  state.skin = skin.id;
  state.skinLabel = skin.label;
  state.step = "confirm";
  setPending(player, state);
  pauseSkinPicker(player);
  showRegisterStep(player, state);
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
      showSkinPicker(player, state);
      break;
    case "confirm":
      showRegisterConfirmDialog(
        player,
        `Nik: ${state.name}\nPochta: ${state.email}\nPol: ${state.gender ? genderLabel(state.gender) : "-"}\nData rozhdeniya: ${formatBirthDate(state.birthDate)}\nSkin: ${state.skinLabel} (${state.skin})\n\nZaregistrirovat' personazha?`
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
        ? "Ty ne prinyal pravila servera."
        : "Registraciya otmenena."
    );
    clearPending(player);
    return;
  }

  const leavingStore = state.step === "skin" || state.step === "confirm";
  state.step = order[index - 1];
  setPending(player, state);
  if (leavingStore && state.step !== "skin") {
    closeSkinPicker(player);
    try {
      prepareAuthView(player);
    } catch {
      // Камера авторизации не обязательна.
    }
  }
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
  applyScore(player, account.level);
  welcome(player, account.name);
  const ip = playerIp(player);
  if (ip) {
    void saveUserLastIp(account.id, ip).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      omp.log(`[${SERVER_TAG}] не удалось сохранить last_ip ${account.name}: ${message}`);
    });
  }
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

    closeSkinPicker(player);
    try {
      prepareAuthView(player);
    } catch {
      // Камера авторизации не обязательна.
    }
    state.step = "email";
    setPending(player, state);
    showEmailDialog(player, state.name, "Eta pochta uzhe zanyata.");
    return;
  }

  if (!isSamePlayer(player, id, state.name)) {
    return;
  }

  if (!state.gender) {
    closeSkinPicker(player);
    try {
      prepareAuthView(player);
    } catch {
      // Камера авторизации не обязательна.
    }
    state.step = "gender";
    setPending(player, state);
    showGenderDialog(player);
    return;
  }

  if (!hasSkin(state.gender, state.skin)) {
    state.step = "skin";
    setPending(player, state);
    showSkinPicker(player, state);
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
    ip: playerIp(player),
  });

  if (!isSamePlayer(player, id, state.name)) {
    return;
  }

  setAccount(player, account);
  clearPending(player);
  spawnIntoWorld(player, account.skin);
  applyWallet(player, account);
  applyScore(player, account.level);
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
    kickLater(player, "Avtorizaciya otmenena.");
    clearPending(player);
    return;
  }

  if (!input) {
    showLoginDialog(player, state.name, "Vvedi parol'.");
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
        kickLater(player, "Slishkom mnogo popytok. Perezaydi.");
        clearPending(player);
        return;
      }

      setPending(player, state);
      showLoginDialog(
        player,
        state.name,
        `Nevernyy parol'. Ostalos' popytok: ${LOGIN_ATTEMPTS - state.attempts}.`
      );
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] ошибка авторизации ${state.name}: ${message}`);
    kickLater(player, "Oshibka avtorizacii. Poprobuy pozhe.");
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
          showEmailDialog(player, state.name, "Eta pochta uzhe zanyata.");
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] ошибка проверки почты: ${message}`);
        kickLater(player, "Ne udalos' proverit' pochtu. Poprobuy pozhe.");
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
        showPasswordConfirmDialog(player, "Paroli ne sovpadayut.");
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
      const gender = genderFromList(listItem, input);
      if (!gender) {
        showGenderDialog(player);
        return;
      }

      state.gender = gender;
      state.step = "skin";
      setPending(player, state);
      showSkinPicker(player, state);
      return;
    }

    case "skin": {
      if (!state.gender) {
        state.step = "gender";
        setPending(player, state);
        showGenderDialog(player);
        return;
      }

      if (isSkinPicking(player)) {
        showSkinPicker(player, state);
        return;
      }

      const skin = skinByIndex(state.gender, listItem);
      if (!skin) {
        showSkinPicker(player, state);
        return;
      }

      state.skin = skin.id;
      state.skinLabel = skin.label;
      state.step = "confirm";
      setPending(player, state);
      closeSkinPicker(player);
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
          closeSkinPicker(player);
          try {
            prepareAuthView(player);
          } catch {
            // Камера авторизации не обязательна.
          }
          state.step = "email";
          setPending(player, state);
          showEmailDialog(player, state.name, "Eta pochta ili nik uzhe zanyaty.");
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        omp.log(`[${SERVER_TAG}] ошибка регистрации ${state.name}: ${message}`);
        kickLater(player, "Ne udalos' sozdat' personazha. Poprobuy pozhe.");
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
