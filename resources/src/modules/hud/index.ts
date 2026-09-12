import { omp, TextDraw, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import type { GameModule } from "../types";

const SHOW_DELAY_MS = 250;
const TITLE = "LS";
const TITLE_ACCENT = "RP";
const SUBTITLE = "Los Santos";

let layers: TextDraw[] = [];

function tryDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function createLogo(): TextDraw[] {
  const draws: TextDraw[] = [];

  const title = tryDraw(() => {
    const draw = new TextDraw(545.5, 4.083317, TITLE);
    draw.setLetterSize(0.45, 1.6);
    draw.setAlignment(1);
    draw.setColor(0xffffffff);
    draw.setShadow(0);
    draw.setOutline(1);
    draw.setBackgroundColor(51);
    draw.setFont(3);
    draw.setProportional(true);
    return draw;
  });
  if (title) {
    draws.push(title);
  }

  const accent = tryDraw(() => {
    const draw = new TextDraw(568.0, 3.916654, TITLE_ACCENT);
    draw.setLetterSize(0.45, 1.6);
    draw.setAlignment(1);
    draw.setColor(10092543);
    draw.setShadow(0);
    draw.setOutline(1);
    draw.setBackgroundColor(51);
    draw.setFont(3);
    draw.setProportional(true);
    return draw;
  });
  if (accent) {
    draws.push(accent);
  }

  const subtitle = tryDraw(() => {
    const draw = new TextDraw(546.0, 16.333332, SUBTITLE);
    draw.setLetterSize(0.221, 1.372499);
    draw.setAlignment(1);
    draw.setColor(0xffffffff);
    draw.setShadow(1);
    draw.setOutline(0);
    draw.setBackgroundColor(51);
    draw.setFont(2);
    draw.setProportional(true);
    return draw;
  });
  if (subtitle) {
    draws.push(subtitle);
  }

  const mark = tryDraw(() => {
    const draw = new TextDraw(567.5, -12.833312, "LD_SPAC:white");
    draw.setLetterSize(0, -123.450012);
    draw.setTextSize(-40.5, 42.583343);
    draw.setAlignment(1);
    draw.setColor(0xffffffff);
    draw.setUseBox(true);
    draw.setBoxColor(0);
    draw.setShadow(0);
    draw.setOutline(0);
    draw.setFont(5);
    draw.setPreviewModel(19066);
    draw.setPreviewRot(0, 0, 0, 1);
    return draw;
  });
  if (mark) {
    draws.push(mark);
  }

  return draws;
}

function showLogo(player: Player): void {
  for (const draw of layers) {
    try {
      draw.showForPlayer(player);
    } catch {
      // Игрок уже вышел.
    }
  }
}

function hideLogo(player: Player): void {
  for (const draw of layers) {
    try {
      draw.hideForPlayer(player);
    } catch {
      // Игрок уже вышел.
    }
  }
}

export const hudModule: GameModule = {
  name: "hud",
  start() {
    layers = createLogo();
    if (layers.length === 0) {
      omp.log(`[${SERVER_TAG}] логотип не создан`);
      return;
    }

    omp.on("playerConnect", (player) => {
      setTimeout(() => {
        if (isPlayerActive(player)) {
          showLogo(player);
        }
      }, SHOW_DELAY_MS);
    });

    omp.on("playerDisconnect", (player) => {
      hideLogo(player);
    });
  },
};
