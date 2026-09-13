import { omp, TextDraw, type Player } from "@omp-node/core";
import { SERVER_TAG } from "../../shared/brand";
import { isPlayerActive } from "../../shared/player";
import type { GameModule } from "../types";

const SHOW_DELAY_MS = 250;

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
  const logo = tryDraw(() => {
    const draw = new TextDraw(545.0, 4.0, "Los_Santos_RP");
    draw.setLetterSize(0.33, 1.5);
    draw.setTextSize(1280.0, 1280.0);
    draw.setAlignment(0);
    draw.setColor(0x0099ffff);
    draw.setUseBox(false);
    draw.setBoxColor(0x80808080);
    draw.setShadow(2);
    draw.setOutline(1);
    draw.setBackgroundColor(0x000077ff);
    draw.setFont(1);
    draw.setProportional(true);
    draw.setSelectable(false);
    return draw;
  });
  if (logo) {
    draws.push(logo);
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
