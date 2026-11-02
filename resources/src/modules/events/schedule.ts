import { gpsCategoryNumber } from "../gps";

const REG_MS = 10 * 60 * 1000;
const TICK_MS = 1000;

export type HourParity = "even" | "odd";

export type ScheduledEvent = {
  id: string;
  name: string;
  parity: HourParity;
  openRegistration: (startAt: number) => void;
  closeRegistration: (startAt: number) => void;
};

const rotation: ScheduledEvent[] = [];
const armed = new Map<string, number>();
let bound = false;

export function registerScheduledEvent(event: ScheduledEvent): void {
  if (rotation.some((item) => item.id === event.id)) {
    return;
  }
  rotation.push(event);
}

export function registrationLeadMs(): number {
  return REG_MS;
}

/** Ближайший чётный или нечётный час старта. */
export function hourAtOrAfter(parity: HourParity, now: number): number {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  const hour = date.getHours();
  const matches = parity === "even" ? hour % 2 === 0 : hour % 2 === 1;
  if (matches && now <= date.getTime()) {
    return date.getTime();
  }
  date.setHours(hour + (matches ? 2 : 1));
  return date.getTime();
}

/** Ближайшее чётное время старта, включая текущую секунду, если она ровно на границе. */
export function evenHourAtOrAfter(now: number): number {
  return hourAtOrAfter("even", now);
}

export function nextRegistrationOpenFor(parity: HourParity, now = Date.now()): number {
  const start = hourAtOrAfter(parity, now);
  const open = start - REG_MS;
  if (now <= open || now < start) {
    return open;
  }
  return hourAtOrAfter(parity, start + 1) - REG_MS;
}

export function nextRegistrationOpen(now = Date.now()): number {
  return nextRegistrationOpenFor("even", now);
}

export function formatClock(ms: number): string {
  const date = new Date(ms);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function bindEventSchedule(): void {
  if (bound) {
    return;
  }
  bound = true;
  setInterval(tickSchedule, TICK_MS);
}

function tickSchedule(): void {
  if (rotation.length === 0) {
    return;
  }

  const now = Date.now();
  for (const event of rotation) {
    const start = hourAtOrAfter(event.parity, now);
    const open = start - REG_MS;
    const armedStart = armed.get(event.id) ?? null;

    if (now >= open && now < start) {
      if (armedStart !== start) {
        armed.set(event.id, start);
        event.openRegistration(start);
      }
      continue;
    }

    if (armedStart !== null && now >= armedStart) {
      armed.delete(event.id);
      event.closeRegistration(armedStart);
    }
  }
}

export function entertainmentGpsNumber(): number {
  return gpsCategoryNumber("fun");
}
