export const PAYDAY_EXP = 1;
export const MAX_LEVEL = 100;

export function expForNextLevel(level: number): number {
  return (Math.max(1, level) + 1) * 4;
}

export function applyPaydayExp(
  level: number,
  exp: number,
  gained = PAYDAY_EXP
): { level: number; exp: number; leveled: boolean } {
  let nextLevel = Math.max(1, level);
  let nextExp = Math.max(0, exp) + gained;
  let leveled = false;

  while (nextLevel < MAX_LEVEL) {
    const need = expForNextLevel(nextLevel);
    if (nextExp < need) {
      break;
    }

    nextExp -= need;
    nextLevel += 1;
    leveled = true;
  }

  if (nextLevel >= MAX_LEVEL) {
    nextLevel = MAX_LEVEL;
    nextExp = 0;
  }

  return { level: nextLevel, exp: nextExp, leveled };
}

export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function hourStamp(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
}
