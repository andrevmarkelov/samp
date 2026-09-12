import { omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import type { GameModule } from "../types";

const TICK_MS = 1000;
const IDLE_MS = 10 * 60_000;
const PAUSE_MS = 8_000;
const MOVE_EPS = 0.15;
const VEL_EPS = 0.08;
const LABEL_COLOR = 0xffff00ff;
const LABEL_OFFSET_Z = 0.55;
const LABEL_DRAW_DISTANCE = 25;
const PLAYER_STATE_ONFOOT = 1;
const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;

type Track = {
  lastActiveAt: number;
  lastUpdateAt: number;
  afkSince: number | null;
  fromPause: boolean;
  label: TextLabel | null;
  x: number;
  y: number;
  z: number;
};

const tracks = new Map<number, Track>();

export function isPlayerAfk(player: Player): boolean {
  const id = playerId(player);
  if (id === null) {
    return false;
  }

  return tracks.get(id)?.afkSince != null;
}

export const afkModule: GameModule = {
  name: "afk",
  start() {
    omp.on("playerConnect", (player) => {
      forget(player);
    });

    omp.on("playerText", (player) => {
      touch(player);
    });

    omp.on("playerCommandText", (player) => {
      touch(player);
    });

    omp.on("playerUpdate", (player) => {
      noteClientUpdate(player);
    });

    omp.on("playerDisconnect", (player) => {
      forget(player);
    });

    setInterval(tick, TICK_MS);
  },
};

function tick(): void {
  const now = Date.now();
  const seen = new Set<number>();

  omp.players.forEach((player) => {
    if (!isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    seen.add(id);

    if (!isInWorld(player)) {
      const existing = tracks.get(id);
      if (existing) {
        existing.lastUpdateAt = now;
      }
      return;
    }

    let pos;
    let keys;
    let vel;
    try {
      pos = player.getPos();
      keys = player.getKeys();
      vel = player.getVelocity();
    } catch {
      return;
    }

    const track = getOrCreate(id, now, pos.x, pos.y, pos.z);
    const moved =
      Math.hypot(pos.x - track.x, pos.y - track.y, pos.z - track.z) > MOVE_EPS;
    const driving =
      Math.hypot(vel.x ?? 0, vel.y ?? 0, vel.z ?? 0) > VEL_EPS;
    const pressing =
      (keys.keys ?? 0) !== 0 ||
      (keys.updown ?? 0) !== 0 ||
      (keys.leftright ?? 0) !== 0;

    track.x = pos.x;
    track.y = pos.y;
    track.z = pos.z;

    if (moved || driving || pressing) {
      resumeIfAfk(player, track, now);
      return;
    }

    if (track.afkSince == null) {
      const paused = now - track.lastUpdateAt >= PAUSE_MS;
      if (paused) {
        enterAfk(player, track, now, true);
      } else if (now - track.lastActiveAt >= IDLE_MS) {
        enterAfk(player, track, now, false);
      }
    }

    if (track.afkSince != null) {
      refreshLabel(player, track);
    }
  });

  for (const [id, track] of tracks) {
    if (!seen.has(id)) {
      destroyLabel(track);
      tracks.delete(id);
    }
  }
}

function isInWorld(player: Player): boolean {
  try {
    if (!player.isSpawned()) {
      return false;
    }

    const state = player.getState();
    return (
      state === PLAYER_STATE_ONFOOT ||
      state === PLAYER_STATE_DRIVER ||
      state === PLAYER_STATE_PASSENGER
    );
  } catch {
    return false;
  }
}

function getOrCreate(
  id: number,
  now: number,
  x: number,
  y: number,
  z: number
): Track {
  const existing = tracks.get(id);
  if (existing) {
    return existing;
  }

  const created: Track = {
    lastActiveAt: now,
    lastUpdateAt: now,
    afkSince: null,
    fromPause: false,
    label: null,
    x,
    y,
    z,
  };
  tracks.set(id, created);
  return created;
}

function emptyTrack(now: number): Track {
  return {
    lastActiveAt: now,
    lastUpdateAt: now,
    afkSince: null,
    fromPause: false,
    label: null,
    x: 0,
    y: 0,
    z: 0,
  };
}

function touch(player: Player): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const now = Date.now();
  const track = tracks.get(id) ?? emptyTrack(now);
  tracks.set(id, track);
  resumeIfAfk(player, track, now);
}

function noteClientUpdate(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const track = tracks.get(id);
  if (!track) {
    return;
  }

  const now = Date.now();
  const resumedFromPause =
    track.fromPause &&
    track.afkSince != null &&
    now - track.lastUpdateAt >= PAUSE_MS;

  track.lastUpdateAt = now;

  if (resumedFromPause) {
    resumeIfAfk(player, track, now);
  }
}

function enterAfk(
  player: Player,
  track: Track,
  since: number,
  fromPause: boolean
): void {
  track.afkSince = since;
  track.fromPause = fromPause;
  destroyLabel(track);

  try {
    const world = player.getVirtualWorld();
    const pos = player.getPos();
    const elapsed = Math.max(0, Date.now() - since);
    track.label = new TextLabel(
      labelText(elapsed),
      LABEL_COLOR,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      world,
      false
    );
    track.label.attachToPlayer(player, 0, 0, LABEL_OFFSET_Z);
  } catch {
    track.label = null;
  }
}

function resumeIfAfk(player: Player, track: Track, now: number): void {
  if (track.afkSince != null) {
    const lasted = now - track.afkSince;
    destroyLabel(track);
    track.afkSince = null;
    track.fromPause = false;
    player.sendClientMessage(
      Color.info,
      `Vy prostoyali v AFK ${formatSpoken(lasted)}.`
    );
  }

  track.lastActiveAt = now;
  track.lastUpdateAt = now;
}

function refreshLabel(player: Player, track: Track): void {
  if (track.afkSince == null) {
    return;
  }

  const text = labelText(Date.now() - track.afkSince);
  try {
    if (track.label) {
      track.label.updateText(LABEL_COLOR, text);
      track.label.setVirtualWorld(player.getVirtualWorld());
      return;
    }
  } catch {
    track.label = null;
  }

  enterAfk(player, track, track.afkSince, track.fromPause);
}

function labelText(elapsedMs: number): string {
  return `AFK: ${formatClock(elapsedMs)}`;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function formatSpoken(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) {
    parts.push(`${h} ch`);
  }
  if (m > 0 || h > 0) {
    parts.push(`${m} min`);
  }
  parts.push(`${s} sek`);
  return parts.join(" ");
}

function forget(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const track = tracks.get(id);
  if (track) {
    destroyLabel(track);
  }
  tracks.delete(id);
}

function destroyLabel(track: Track): void {
  if (!track.label) {
    return;
  }

  try {
    track.label.destroy();
  } catch {
    // label already gone
  }
  track.label = null;
}
