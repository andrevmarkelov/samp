import type { Player } from "@omp-node/core";

const BEEP_SOUND = 5205;
const START_SOUND = 1058;
const STEP_MS = 1000;

/** 5, 4, 3, 2 и старт. Последний сигнал совпадает с пуском. */
const STEPS = [BEEP_SOUND, BEEP_SOUND, BEEP_SOUND, BEEP_SOUND, START_SOUND] as const;

function playAtPlayer(player: Player, soundId: number): void {
  try {
    const pos = player.getPos();
    player.playGameSound(soundId, pos.x, pos.y, pos.z);
  } catch {
    // Игрок уже вышел.
  }
}

/** Пять сигналов раз в секунду. На последнем вызывается onStart. Возвращает отмену. */
export function runStartCountdown(
  alive: () => boolean,
  players: () => Player[],
  onStart: () => void
): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  STEPS.forEach((sound, index) => {
    timers.push(
      setTimeout(() => {
        if (cancelled || !alive()) {
          return;
        }
        for (const player of players()) {
          playAtPlayer(player, sound);
        }
        if (index === STEPS.length - 1) {
          onStart();
        }
      }, index * STEP_MS)
    );
  });

  return () => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}
