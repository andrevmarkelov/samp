import { TextDraw, type Player } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";

const TIME_COLOR = 0x00cc00aa;
const LINE_COLOR = 0xffffffaa;
const BACK_COLOR = 0x000000aa;
const BOX_COLOR = 102;

type CaptureHud = {
  time: TextDraw;
  attackers: TextDraw;
  defenders: TextDraw;
  box: TextDraw;
};

const visible = new Set<number>();
let hud: CaptureHud | null = null;

function tryDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function styleLine(draw: TextDraw, color: number): void {
  draw.setAlignment(0);
  draw.setBackgroundColor(BACK_COLOR);
  draw.setFont(1);
  draw.setOutline(1);
  draw.setLetterSize(0.32, 1.6);
  draw.setColor(color);
  draw.setProportional(true);
  draw.setShadow(0);
  draw.setSelectable(false);
}

function createHud(): CaptureHud | null {
  const box = tryDraw(() => {
    const draw = new TextDraw(3.0, 275.0, "_");
    draw.setLetterSize(0.5, 5.899998);
    draw.setTextSize(145.0, 0.0);
    draw.setAlignment(1);
    draw.setColor(0);
    draw.setUseBox(true);
    draw.setBoxColor(BOX_COLOR);
    draw.setOutline(0);
    draw.setShadow(0);
    draw.setFont(0);
    draw.setSelectable(false);
    return draw;
  });
  const time = tryDraw(() => {
    const draw = new TextDraw(13.0, 278.0, "Time:");
    styleLine(draw, TIME_COLOR);
    return draw;
  });
  const attackers = tryDraw(() => {
    const draw = new TextDraw(13.0, 295.0, "_");
    styleLine(draw, LINE_COLOR);
    return draw;
  });
  const defenders = tryDraw(() => {
    const draw = new TextDraw(13.0, 310.0, "_");
    styleLine(draw, LINE_COLOR);
    return draw;
  });

  if (!box || !time || !attackers || !defenders) {
    box?.destroy();
    time?.destroy();
    attackers?.destroy();
    defenders?.destroy();
    return null;
  }

  return { box, time, attackers, defenders };
}

export function startCaptureHud(): boolean {
  if (hud) {
    return true;
  }

  hud = createHud();
  return hud !== null;
}

export function updateCaptureHud(
  timeText: string,
  attackerLine: string,
  defenderLine: string
): void {
  if (!hud) {
    return;
  }

  try {
    hud.time.setString(timeText);
    hud.attackers.setString(attackerLine);
    hud.defenders.setString(defenderLine);
  } catch {
    // TextDraw уже уничтожен.
  }
}

export function showCaptureHud(player: Player): void {
  if (!hud || !isPlayerActive(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    hud.box.showForPlayer(player);
    hud.time.showForPlayer(player);
    hud.attackers.showForPlayer(player);
    hud.defenders.showForPlayer(player);
    visible.add(id);
  } catch {
    // Игрок уже вышел.
  }
}

export function hideCaptureHud(player: Player): void {
  const id = playerId(player);
  if (id !== null) {
    visible.delete(id);
  }

  if (!hud) {
    return;
  }

  try {
    hud.box.hideForPlayer(player);
    hud.time.hideForPlayer(player);
    hud.attackers.hideForPlayer(player);
    hud.defenders.hideForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

export function hideCaptureHudAll(): void {
  visible.clear();
  if (!hud) {
    return;
  }

  try {
    hud.box.hideForAll();
    hud.time.hideForAll();
    hud.attackers.hideForAll();
    hud.defenders.hideForAll();
  } catch {
    // TextDraw уже уничтожен.
  }
}

export function clearCaptureHudSlot(slot: number): void {
  visible.delete(slot);
}
