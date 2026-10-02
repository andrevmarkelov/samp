import {
  computePaidUntil,
  formatRentDate,
  currentDateLocal,
  rentDaysRemaining,
  rentDaysLeftLabel,
} from "../houses/rent-math";

/** Доля от стоимости бизнеса в день (0.1%), как у домов. */
export const BUSINESS_TAX_RATE = 0.001;

export function dailyBusinessTax(price: number): number {
  return Math.max(1, Math.floor(price * BUSINESS_TAX_RATE));
}

export function taxAmountForDays(price: number, days: number): number {
  return dailyBusinessTax(price) * days;
}

export {
  computePaidUntil,
  formatRentDate,
  currentDateLocal,
  rentDaysRemaining,
  rentDaysLeftLabel,
};