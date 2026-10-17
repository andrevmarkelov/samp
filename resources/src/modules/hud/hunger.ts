import { PlayerTextDraw, omp, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isSkinPicking } from "../auth/skin-picker";
import {
  MAX_HUNGER,
  getAccount,
  isAuthenticated,
  normalizeHunger,
} from "../auth/session";

const REFRESH_MS = 400;
const PLAYER_STATE_WASTED = 7;
const PLAYER_STATE_SPECTATING = 9;

/**
 * Между бронёй (выше) и здоровьем (ниже), тот же размер.
 * Рамка как у них: чёрный контур и заливка внутри.
 */
const TRACK_X = 547.24;
const TRACK_Y = 58.05;
const TRACK_RIGHT = 606.65;
const TRACK_LETTER_Y = 0.52;
const FILL_X = 549.15;
const FILL_Y = 59.25;
const FILL_RIGHT = 604.74;
const FILL_LETTER_Y = 0.28;

const TRACK_COLOR = 0x000000ff;
const FILL_HIGH = 0x7cac5aff;
const FILL_MID = 0xd4a24aff;
const FILL_LOW = 0xc44b3cff;

type HungerBar = {
  track: PlayerTextDraw;
  fill: PlayerTextDraw;
  shown: boolean;
  hunger: number;
};

const bars = new Map<number, HungerBar>();

function tryDraw(build: () => PlayerTextDraw): PlayerTextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function styleBar(draw: PlayerTextDraw, x: number, y: number, letterY: number): void {
  draw.setLetterSize(0, letterY);
  draw.setTextSize(x, 0);
  draw.setAlignment(1);
  draw.setColor(0);
  draw.useBox(true);
  draw.setOutline(0);
  draw.setShadow(0);
  draw.setBackgroundColor(0);
  draw.setFont(1);
  draw.setProportional(true);
  draw.setSelectable(false);
}

function createBar(player: Player): HungerBar | null {
  const track = tryDraw(() => {
    const draw = new PlayerTextDraw(player, TRACK_X, TRACK_Y, "_");
    styleBar(draw, TRACK_RIGHT, TRACK_Y, TRACK_LETTER_Y);
    draw.setBoxColor(TRACK_COLOR);
    return draw;
  });
  const fill = tryDraw(() => {
    const draw = new PlayerTextDraw(player, FILL_X, FILL_Y, "_");
    styleBar(draw, FILL_X, FILL_Y, FILL_LETTER_Y);
    draw.setBoxColor(FILL_HIGH);
    return draw;
  });

  if (!track || !fill) {
    track?.destroy();
    fill?.destroy();
    return null;
  }

  return { track, fill, shown: false, hunger: -1 };
}

function ensureBar(player: Player, slotId: number): HungerBar | null {
  const cached = bars.get(slotId);
  if (cached) {
    return cached;
  }

  const bar = createBar(player);
  if (bar) {
    bars.set(slotId, bar);
  }
  return bar;
}

function destroyBar(slotId: number): void {
  const bar = bars.get(slotId);
  if (!bar) {
    return;
  }

  bars.delete(slotId);
  for (const draw of [bar.track, bar.fill]) {
    try {
      draw.destroy();
    } catch {
      // Уже уничтожен.
    }
  }
}

function hideBar(bar: HungerBar): void {
  if (!bar.shown) {
    return;
  }

  for (const draw of [bar.track, bar.fill]) {
    try {
      draw.hide();
    } catch {
      // Игрок уже вышел.
    }
  }
  bar.shown = false;
}

function fillColor(hunger: number): number {
  if (hunger > 40) {
    return FILL_HIGH;
  }
  if (hunger > 20) {
    return FILL_MID;
  }
  return FILL_LOW;
}

function fillRight(hunger: number): number {
  const span = FILL_RIGHT - FILL_X;
  return FILL_X + (hunger / MAX_HUNGER) * span;
}

function shouldShow(player: Player): boolean {
  if (!isPlayerActive(player) || !isAuthenticated(player) || isSkinPicking(player)) {
    return false;
  }

  try {
    if (!player.isSpawned()) {
      return false;
    }
    const state = player.getState();
    return state !== PLAYER_STATE_WASTED && state !== PLAYER_STATE_SPECTATING;
  } catch {
    return false;
  }
}

function paint(bar: HungerBar, hunger: number, visible: boolean): void {
  if (!visible) {
    hideBar(bar);
    return;
  }

  const changed = !bar.shown || bar.hunger !== hunger;
  if (!changed) {
    return;
  }

  try {
    bar.fill.hide();
    if (!bar.shown) {
      bar.track.show();
    }
    if (hunger > 0) {
      const right = fillRight(hunger);
      if (right > FILL_X) {
        bar.fill.setTextSize(right, 0);
        bar.fill.setBoxColor(fillColor(hunger));
        bar.fill.show();
      }
    }
    bar.shown = true;
    bar.hunger = hunger;
  } catch {
    bar.shown = false;
  }
}

function syncPlayer(player: Player): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  if (!shouldShow(player)) {
    const bar = bars.get(slotId);
    if (bar) {
      hideBar(bar);
    }
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const bar = ensureBar(player, slotId);
  if (!bar) {
    return;
  }

  paint(bar, normalizeHunger(account.hunger), true);
}

export function startHungerBar(): void {
  omp.on("playerSpawn", (player) => {
    syncPlayer(player);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      destroyBar(slotId);
    }
  });

  setInterval(() => {
    omp.players.forEach((player) => {
      syncPlayer(player);
    });
  }, REFRESH_MS);
}
