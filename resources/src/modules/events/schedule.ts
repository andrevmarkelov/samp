import { gpsCategoryNumber } from "../gps";

const REG_MS = 10 * 60 * 1000;
const TICK_MS = 1000;

export type ScheduledEvent = {
  id: string;
  name: string;
  openRegistration: (startAt: number) => void;
  closeRegistration: (startAt: number) => void;
};

const rotation: ScheduledEvent[] = [];
let armedStart: number | null = null;
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

/** Ближайшее чётное время старта, включая текущую секунду, если она ровно на границе. */
export function evenHourAtOrAfter(now: number): number {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  const hour = date.getHours();
  if (hour % 2 === 0) {
    if (now <= date.getTime()) {
      return date.getTime();
    }
    date.setHours(hour + 2);
    return date.getTime();
  }
  date.setHours(hour + 1);
  return date.getTime();
}

export function nextRegistrationOpen(now = Date.now()): number {
  const start = evenHourAtOrAfter(now);
  const open = start - REG_MS;
  if (now <= open || now < start) {
    return open;
  }
  return evenHourAtOrAfter(start + 1) - REG_MS;
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
  const start = evenHourAtOrAfter(now);
  const open = start - REG_MS;

  if (now >= open && now < start) {
    if (armedStart !== start) {
      armedStart = start;
      eventFor(start).openRegistration(start);
    }
    return;
  }

  if (armedStart !== null && now >= armedStart) {
    const closing = armedStart;
    armedStart = null;
    eventFor(closing).closeRegistration(closing);
  }
}

function eventFor(start: number): ScheduledEvent {
  const date = new Date(start);
  const hourSlot = Math.floor(date.getHours() / 2);
  const yearStart = new Date(date.getFullYear(), 0, 1).getTime();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = Math.floor((dayStart - yearStart) / 86_400_000);
  const index = (day * (24 / 2) + hourSlot) % rotation.length;
  const event = rotation[index] ?? rotation[0];
  if (!event) {
    throw new Error("Список мероприятий пуст.");
  }
  return event;
}

export function entertainmentGpsNumber(): number {
  return gpsCategoryNumber("fun");
}
