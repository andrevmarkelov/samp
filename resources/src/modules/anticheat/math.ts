export function dist3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Скорость в условных «км/ч» из velocity SA-MP. */
export function speedFromVelocity(vx: number, vy: number, vz: number): number {
  return Math.round(Math.hypot(vx, vy, vz) * 179.28625);
}

export function nowMs(): number {
  return Date.now();
}
