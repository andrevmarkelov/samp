import { TextDraw, omp, type Player, type Vehicle } from "@omp-node/core";
import { isPlayerActive, playerId } from "../../shared/player";
import { isEngineOn } from "../vehicles/spawn";

const PLAYER_STATE_DRIVER = 2;
const UPDATE_MS = 500;
const SPEED_FACTOR = 120.666667;

/** Статика: топливо и буквы кроме M. Живые: скорость, HP кузова, мотор. */
const STATIC_FUEL = "Fuel 100";

type SpeedoDraws = {
  speed: TextDraw;
  fuel: TextDraw;
  health: TextDraw;
  status: TextDraw;
};

let background: TextDraw | null = null;
const draws = new Map<number, SpeedoDraws>();
const timers = new Map<number, ReturnType<typeof setInterval>>();

function tryDraw(build: () => TextDraw): TextDraw | null {
  try {
    return build();
  } catch {
    return null;
  }
}

function createBackground(): TextDraw | null {
  return tryDraw(() => {
    const draw = new TextDraw(522.2, 402.0, "_");
    draw.setUseBox(true);
    draw.setBoxColor(0x00000055);
    draw.setTextSize(0.0, 198.0);
    draw.setLetterSize(0.0, 3.3);
    draw.setAlignment(2);
    return draw;
  });
}

function styleLine(draw: TextDraw): void {
  draw.setLetterSize(0.4, 1.629999);
  draw.setOutline(1);
  draw.setFont(1);
}

function createPlayerDraws(): SpeedoDraws | null {
  const speed = tryDraw(() => {
    const draw = new TextDraw(425.0, 401.5, "_");
    draw.setColor(0x0097ffaa);
    styleLine(draw);
    return draw;
  });
  const fuel = tryDraw(() => {
    const draw = new TextDraw(502.6, 401.5, STATIC_FUEL);
    draw.setColor(0x00e1ffc8);
    styleLine(draw);
    return draw;
  });
  const health = tryDraw(() => {
    const draw = new TextDraw(577.2, 401.5, "1000");
    draw.setColor(0x323b7faa);
    styleLine(draw);
    return draw;
  });
  const status = tryDraw(() => {
    const draw = new TextDraw(425.0, 416.5, statusLine(false));
    styleLine(draw);
    return draw;
  });

  if (!speed || !fuel || !health || !status) {
    speed?.destroy();
    fuel?.destroy();
    health?.destroy();
    status?.destroy();
    return null;
  }

  return { speed, fuel, health, status };
}

function ensureDraws(id: number): SpeedoDraws | null {
  const existing = draws.get(id);
  if (existing) {
    return existing;
  }

  const hud = createPlayerDraws();
  if (hud) {
    draws.set(id, hud);
  }
  return hud;
}

function destroyPlayerDraws(id: number): void {
  const hud = draws.get(id);
  if (!hud) {
    return;
  }

  for (const draw of [hud.speed, hud.fuel, hud.health, hud.status]) {
    try {
      draw.destroy();
    } catch {
      // Уже уничтожен.
    }
  }

  draws.delete(id);
}

function hideFor(player: Player, id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearInterval(timer);
    timers.delete(id);
  }

  const hud = draws.get(id);
  if (!hud) {
    return;
  }

  try {
    hud.speed.hideForPlayer(player);
    hud.fuel.hideForPlayer(player);
    hud.health.hideForPlayer(player);
    hud.status.hideForPlayer(player);
    background?.hideForPlayer(player);
  } catch {
    // Игрок уже вышел.
  }
}

function statusLine(engineOn: boolean): string {
  const motor = engineOn ? "~g~M" : "~w~M";
  return `~g~Open    ~w~max   ~w~E ~w~S   ${motor} ~w~L ~w~B`;
}

function driverVehicle(player: Player): Vehicle | null {
  try {
    if (!player.isInAnyVehicle()) {
      return null;
    }

    return omp.vehicles.at(player.getVehicleID()) ?? null;
  } catch {
    return null;
  }
}

function vehicleHealth(vehicle: Vehicle): number {
  try {
    return Math.round(vehicle.getHealth());
  } catch {
    return 0;
  }
}

function vehicleSpeedKmh(vehicle: Vehicle): number {
  try {
    const vel = vehicle.getVelocity();
    const vx = vel.x ?? 0;
    const vy = vel.y ?? 0;
    const vz = vel.z ?? 0;
    return Math.round(Math.sqrt(vx * vx + vy * vy + vz * vz) * SPEED_FACTOR);
  } catch {
    return 0;
  }
}

function updateSpeed(player: Player, id: number): void {
  if (!isPlayerActive(player)) {
    hideFor(player, id);
    destroyPlayerDraws(id);
    return;
  }

  const hud = draws.get(id);
  if (!hud) {
    hideFor(player, id);
    return;
  }

  const vehicle = driverVehicle(player);
  if (!vehicle) {
    try {
      if (player.getState() === PLAYER_STATE_DRIVER) {
        return;
      }
    } catch {
      // Слот уже невалиден.
    }
    hideFor(player, id);
    return;
  }

  try {
    hud.speed.setString(`${vehicleSpeedKmh(vehicle)} km/h`);
    hud.health.setString(`${vehicleHealth(vehicle)}`);
    hud.status.setString(statusLine(isEngineOn(vehicle)));
  } catch {
    // Textdraw уже уничтожен.
  }
}

function showFor(player: Player, id: number): void {
  if (!background || !ensureDraws(id)) {
    return;
  }

  if (timers.has(id)) {
    return;
  }

  const hud = draws.get(id);
  if (!hud) {
    return;
  }

  try {
    hud.speed.showForPlayer(player);
    hud.fuel.showForPlayer(player);
    hud.health.showForPlayer(player);
    hud.status.showForPlayer(player);
    background.showForPlayer(player);
  } catch {
    return;
  }

  updateSpeed(player, id);
  timers.set(
    id,
    setInterval(() => {
      updateSpeed(player, id);
    }, UPDATE_MS)
  );
}

function bindPlayer(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  hideFor(player, id);
  destroyPlayerDraws(id);
  ensureDraws(id);
}

export function startSpeedo(): void {
  background = createBackground();
  if (!background) {
    return;
  }

  omp.on("playerConnect", (player) => {
    bindPlayer(player);
  });

  omp.on("playerStateChange", (player, newState) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    if (newState === PLAYER_STATE_DRIVER) {
      showFor(player, id);
      return;
    }

    hideFor(player, id);
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    hideFor(player, id);
    destroyPlayerDraws(id);
  });

  for (const player of omp.players.all()) {
    bindPlayer(player);
    const id = playerId(player);
    if (id === null) {
      continue;
    }

    try {
      if (player.getState() === PLAYER_STATE_DRIVER) {
        showFor(player, id);
      }
    } catch {
      // Слот пустой.
    }
  }
}
