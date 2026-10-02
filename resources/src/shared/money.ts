/** Деньги для UI: пробелы между тысячами, `$` в конце (`5 000$`). */
export function formatMoney(amount: number): string {
  const value = Number.isFinite(amount) ? Math.trunc(amount) : 0;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const spaced = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${spaced}$`;
}
