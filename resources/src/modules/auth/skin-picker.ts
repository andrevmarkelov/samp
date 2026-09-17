import { INVALID_TEXTDRAW, TextDraw, omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { writeSpawnInfo, type SpawnPoint } from "../spawn/point";
import type { Gender } from "./gender";
import { skinByIndex, skinIndexOf, wrapSkinIndex, type SkinOption } from "./skins";

const PICKER_INTERIOR = 3;
const PICKER_WORLD_BASE = 10_000;
const HOVER_COLOR = 0xccccccff;
const ANIM_SYNC_ALL = 1;
const ARROW_SOUND_ID = 1083;
const CAMERA = { x: 206.46, y: -137.7, z: 1003.09 };
const STAND: SpawnPoint = {
  x: 206.46,
  y: -129.8,
  z: 1003.09,
  angle: facingTowards({ x: 206.46, y: -129.8 }, CAMERA),
  interior: PICKER_INTERIOR,
  world: 0,
};

function facingTowards(
  from: { x: number; y: number },
  to: { x: number; y: number }
): number {
  const angle = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

type PickerSession = {
  gender: Gender;
  index: number;
};

type PickerDraws = {
  all: TextDraw[];
  prev: TextDraw;
  next: TextDraw;
  select: TextDraw;
};

const sessions = new Map<number, PickerSession>();
const facingTimers = new Map<number, ReturnType<typeof setInterval>>();
const ignoreCancel = new Set<number>();
let draws: PickerDraws | null = null;

function startFacingLock(player: Player, id: number): void {
  stopFacingLock(id);
  facingTimers.set(
    id,
    setInterval(() => {
      if (!isSkinPicking(player) || !isPlayerActive(player)) {
        stopFacingLock(id);
        return;
      }

      try {
        player.setFacingAngle(pickerPoint(player).angle);
      } catch {
        // Игрок уже вышел.
      }
    }, 100)
  );
}

function stopFacingLock(id: number): void {
  const timer = facingTimers.get(id);
  if (!timer) {
    return;
  }

  clearInterval(timer);
  facingTimers.delete(id);
}

function playPickerSound(player: Player, soundId: number): void {
  try {
    const pos = player.getPos();
    player.playGameSound(soundId, pos.x, pos.y, pos.z);
  } catch {
    try {
      player.playGameSound(soundId, 0, 0, 0);
    } catch {
      // Слот пустой.
    }
  }
}

function pawnColor(value: number): number {
  return value >>> 0;
}

function tryDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function pickerWorld(player: Player): number {
  return PICKER_WORLD_BASE + (playerId(player) ?? 0);
}

function pickerPoint(player: Player): SpawnPoint {
  return { ...STAND, world: pickerWorld(player) };
}

export function isSkinPicking(player: Player): boolean {
  const id = playerId(player);
  return id !== null && sessions.has(id);
}

export function selectedSkin(player: Player): SkinOption | null {
  const id = playerId(player);
  const session = id === null ? undefined : sessions.get(id);
  if (!session) {
    return null;
  }
  return skinByIndex(session.gender, session.index);
}

function createDraws(): PickerDraws | null {

  const td0 = tryDraw(() => {
    const draw = new TextDraw(610.0, 44.0, "_");
    draw.setLetterSize(0.3, 1.0);
    draw.setTextSize(1280.0, 1280.0);
    draw.setAlignment(0);
    draw.setColor(pawnColor(-572662273));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(3);
    draw.setProportional(false);
    draw.setShadow(2);
    return draw;
  });

  const select = tryDraw(() => {
    const draw = new TextDraw(320.0, 408.4375, "SELECT");
    draw.setLetterSize(0.2205, 1.0575);
    draw.setTextSize(82.0, 20.0);
    draw.setAlignment(2);
    draw.setColor(pawnColor(-1));
    draw.setBackgroundColor(255);
    draw.setFont(2);
    draw.setProportional(true);
    draw.setShadow(0);
    draw.setSelectable(true);
    return draw;
  });

  const td2 = tryDraw(() => {
    const draw = new TextDraw(252.0, 406.5625, "LD_SPAC:WHITE");
    draw.setLetterSize(0.6, 2.0);
    draw.setTextSize(28.0, 15.0);
    draw.setAlignment(1);
    draw.setColor(pawnColor(656880639));
    draw.setUseBox(true);
    draw.setBoxColor(pawnColor(838860800));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(4);
    draw.setProportional(true);
    draw.setShadow(0);
    return draw;
  });

  const td3 = tryDraw(() => {
    const draw = new TextDraw(239.0, 403.0625, "LD_BEAT:CHIT");
    draw.setLetterSize(0.6, 2.0);
    draw.setTextSize(24.0, 22.1);
    draw.setAlignment(1);
    draw.setColor(pawnColor(656880639));
    draw.setUseBox(true);
    draw.setBoxColor(pawnColor(838860800));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(4);
    draw.setProportional(true);
    draw.setShadow(0);
    return draw;
  });

  const td4 = tryDraw(() => {
    const draw = new TextDraw(360.0, 406.5625, "LD_SPAC:WHITE");
    draw.setLetterSize(0.6, 2.0);
    draw.setTextSize(28.0, 15.0);
    draw.setAlignment(1);
    draw.setColor(pawnColor(656880639));
    draw.setUseBox(true);
    draw.setBoxColor(pawnColor(838860800));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(4);
    draw.setProportional(true);
    draw.setShadow(0);
    return draw;
  });

  const td5 = tryDraw(() => {
    const draw = new TextDraw(377.0, 403.0625, "LD_BEAT:CHIT");
    draw.setLetterSize(0.6, 2.0);
    draw.setTextSize(24.0, 22.1);
    draw.setAlignment(1);
    draw.setColor(pawnColor(656880639));
    draw.setUseBox(true);
    draw.setBoxColor(pawnColor(838860800));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(4);
    draw.setProportional(true);
    draw.setShadow(0);
    return draw;
  });

  const td6 = tryDraw(() => {
    const draw = new TextDraw(279.5, 406.5625, "LD_SPAC:WHITE");
    draw.setLetterSize(0.6, 2.0);
    draw.setTextSize(81.0, 15.0);
    draw.setAlignment(1);
    draw.setColor(pawnColor(488450047));
    draw.setUseBox(true);
    draw.setBoxColor(pawnColor(838860800));
    draw.setOutline(1);
    draw.setBackgroundColor(255);
    draw.setFont(4);
    draw.setProportional(true);
    draw.setShadow(0);
    return draw;
  });

  const prev = tryDraw(() => {
    const draw = new TextDraw(254.0, 407.4375, "<<<");
    draw.setLetterSize(0.2675, 1.3768);
    draw.setTextSize(282.0, 429.5);
    draw.setAlignment(1);
    draw.setColor(pawnColor(-1));
    draw.setBackgroundColor(255);
    draw.setFont(1);
    draw.setProportional(true);
    draw.setShadow(0);
    draw.setSelectable(true);
    return draw;
  });

  const next = tryDraw(() => {
    const draw = new TextDraw(370.5, 407.4375, ">>>");
    draw.setLetterSize(0.2675, 1.3768);
    draw.setTextSize(399.0, 429.5);
    draw.setAlignment(1);
    draw.setColor(pawnColor(-1));
    draw.setBackgroundColor(255);
    draw.setFont(1);
    draw.setProportional(true);
    draw.setShadow(0);
    draw.setSelectable(true);
    return draw;
  });

  if (!select || !prev || !next) {
    for (const draw of [td0, select, td2, td3, td4, td5, td6, prev, next]) {
      try {
        draw?.destroy();
      } catch {
        // Не создан.
      }
    }
    return null;
  }

  const all = [td0, td2, td3, td4, td5, td6, select, prev, next].filter(
    (draw): draw is TextDraw => draw !== null
  );
  return { all, prev, next, select };
}

function showDraws(player: Player): void {
  if (!draws) {
    return;
  }

  for (const draw of draws.all) {
    try {
      draw.showForPlayer(player);
    } catch {
      // Игрок уже вышел.
    }
  }

  try {
    player.selectTextDraw(HOVER_COLOR);
  } catch {
    // Курсор не обязателен с первой попытки.
  }
}

function hideDraws(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    ignoreCancel.add(id);
  }

  if (draws) {
    for (const draw of draws.all) {
      try {
        draw.hideForPlayer(player);
      } catch {
        // Игрок уже вышел.
      }
    }
  }

  try {
    player.cancelSelectTextDraw();
  } catch {
    // Курсор уже скрыт.
  }

  if (id !== null) {
    setTimeout(() => {
      ignoreCancel.delete(id);
    }, 0);
  }
}

function applyCamera(player: Player): void {
  const point = pickerPoint(player);
  try {
    player.setCameraPos(CAMERA.x, CAMERA.y, CAMERA.z);
    player.setCameraLookAt(point.x, point.y, point.z + 0.62, 2);
  } catch {
    // Слот ещё не готов.
  }
}

function preloadPickerAnims(player: Player): void {
  try {
    player.applyAnimation("CARRY", "crry_prtial", 4.0, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.applyAnimation("DEALER", "DEALER_IDLE", 4.1, false, false, false, false, 1, ANIM_SYNC_ALL);
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Библиотека подтянется на следующей попытке.
  }
}

function lockFacing(player: Player): void {
  const angle = pickerPoint(player).angle;
  try {
    player.setFacingAngle(angle);
    player.setVelocity(0, 0, 0);
    player.applyAnimation("DEALER", "DEALER_IDLE", 4.1, false, true, true, true, 0, ANIM_SYNC_ALL);
    player.setFacingAngle(angle);
  } catch {
    try {
      player.setFacingAngle(angle);
    } catch {
      // Слот ещё не готов.
    }
  }
}

function applyPreview(player: Player, skinId: number): void {
  const point = pickerPoint(player);
  try {
    writeSpawnInfo(player, skinId, point);
    player.setInterior(point.interior);
    player.setVirtualWorld(point.world);
    player.setPos(point.x, point.y, point.z);
    player.setSkin(skinId);
    player.toggleControllable(false);
    player.setFacingAngle(point.angle);
    applyCamera(player);
    lockFacing(player);
  } catch {
    // Слот ещё не готов.
  }
}

function holdPreview(player: Player): void {
  const point = pickerPoint(player);
  try {
    player.setInterior(point.interior);
    player.setVirtualWorld(point.world);
    player.setPos(point.x, point.y, point.z);
    player.toggleControllable(false);
    applyCamera(player);
    lockFacing(player);
  } catch {
    // Слот ещё не готов.
  }
}

function leaveSpectate(player: Player, skinId: number): void {
  const point = pickerPoint(player);
  try {
    writeSpawnInfo(player, skinId, point);
  } catch {
    return;
  }

  try {
    if (!player.isSpawned()) {
      player.toggleSpectating(false);
    }
  } catch {
    try {
      player.toggleSpectating(false);
    } catch {
      // Спавн ещё не доступен.
    }
  }
}

export function openSkinPicker(player: Player, gender: Gender, skinId = 0): SkinOption | null {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player)) {
    return null;
  }

  if (!draws) {
    draws = createDraws();
  }
  if (!draws) {
    return null;
  }

  const index = skinId > 0 ? skinIndexOf(gender, skinId) : 0;
  const skin = skinByIndex(gender, index);
  if (!skin) {
    return null;
  }

  const alreadyOpen = sessions.has(id);
  sessions.set(id, { gender, index });
  leaveSpectate(player, skin.id);
  preloadPickerAnims(player);
  applyPreview(player, skin.id);
  showDraws(player);
  startFacingLock(player, id);

  if (!alreadyOpen) {
    for (const delay of [80, 250, 600]) {
      setTimeout(() => {
        if (!isSkinPicking(player) || !isPlayerActive(player)) {
          return;
        }
        holdPreview(player);
        showDraws(player);
      }, delay);
    }
  }

  return skin;
}

export function pauseSkinPicker(player: Player): void {
  hideDraws(player);
}

export function resumeSkinPreview(player: Player, gender: Gender, skinId: number): boolean {
  const id = playerId(player);
  if (id === null || !isPlayerActive(player)) {
    return false;
  }

  const index = skinId > 0 ? skinIndexOf(gender, skinId) : 0;
  const skin = skinByIndex(gender, index);
  if (!skin) {
    return false;
  }

  sessions.set(id, { gender, index });
  applyPreview(player, skin.id);
  startFacingLock(player, id);
  return true;
}

export function closeSkinPicker(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    stopFacingLock(id);
    sessions.delete(id);
    ignoreCancel.delete(id);
  }
  hideDraws(player);

  try {
    player.clearAnimations(ANIM_SYNC_ALL);
  } catch {
    // Анимации уже сброшены.
  }
}

export function cycleSkin(player: Player, delta: number): SkinOption | null {
  const id = playerId(player);
  const session = id === null ? undefined : sessions.get(id);
  if (!session) {
    return null;
  }

  session.index = wrapSkinIndex(session.gender, session.index + delta);
  const skin = skinByIndex(session.gender, session.index);
  if (!skin) {
    return null;
  }

  applyPreview(player, skin.id);
  return skin;
}

function sameDraw(clicked: unknown, draw: TextDraw): boolean {
  if (clicked === draw) {
    return true;
  }

  try {
    const clickedId =
      clicked && typeof clicked === "object" && "getID" in clicked
        ? Number((clicked as TextDraw).getID())
        : Number(clicked);
    const drawId = Number(draw.getID());
    return Number.isInteger(clickedId) && clickedId === drawId;
  } catch {
    return false;
  }
}

function isCancelClick(clicked: unknown): boolean {
  if (clicked === null || clicked === undefined || clicked === false) {
    return true;
  }

  try {
    if (
      clicked &&
      typeof clicked === "object" &&
      "getID" in clicked &&
      Number((clicked as TextDraw).getID()) === INVALID_TEXTDRAW
    ) {
      return true;
    }
  } catch {
    // Невалидный объект клика.
  }

  const numeric = Number(clicked);
  return numeric === -1 || numeric === INVALID_TEXTDRAW;
}

export function bindSkinPicker(
  onAction: (player: Player, action: "prev" | "next" | "select" | "cancel") => void
): void {
  if (!draws) {
    draws = createDraws();
  }

  omp.on("playerClickTextDraw", (player, textdraw) => {
    if (!isSkinPicking(player)) {
      return;
    }

    if (isCancelClick(textdraw)) {
      const id = playerId(player);
      if (id !== null && ignoreCancel.has(id)) {
        return;
      }
      onAction(player, "cancel");
      return;
    }

    if (!draws) {
      return;
    }

    if (sameDraw(textdraw, draws.prev)) {
      playPickerSound(player, ARROW_SOUND_ID);
      onAction(player, "prev");
      return;
    }
    if (sameDraw(textdraw, draws.next)) {
      playPickerSound(player, ARROW_SOUND_ID);
      onAction(player, "next");
      return;
    }
    if (sameDraw(textdraw, draws.select)) {
      onAction(player, "select");
    }
  });

  omp.on("playerDisconnect", (player) => {
    closeSkinPicker(player);
  });
}
