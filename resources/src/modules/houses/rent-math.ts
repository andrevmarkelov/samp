/** Доля от стоимости дома в день (0.1%). */
export const HOUSE_RENT_RATE = 0.001;

export function dailyHouseRent(price: number): number {
  return Math.max(1, Math.floor(price * HOUSE_RENT_RATE));
}

export function currentDateLocal(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRentDate(isoDate: string | null): string {
  if (!isoDate) {
    return "не оплачено";
  }

  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }

  return `${day}.${month}.${year}`;
}

export function computePaidUntil(current: string | null, days: number): string {
  const today = currentDateLocal();
  const base = current !== null && current >= today ? current : today;
  return addDays(base, days);
}

export function rentAmountForDays(price: number, days: number): number {
  return dailyHouseRent(price) * days;
}

/** Сколько календарных дней осталось до конца оплаченного срока (0 — сегодня последний день). */
export function rentDaysRemaining(paidUntil: string | null): number | null {
  if (!paidUntil) {
    return null;
  }

  const today = currentDateLocal();
  if (paidUntil < today) {
    return 0;
  }

  return diffCalendarDays(today, paidUntil);
}

export function rentDaysLeftLabel(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }
  return "дней";
}

export function parseRentDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return formatDateLocal(value);
  }

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  return null;
}

function diffCalendarDays(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateLocal(date);
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
