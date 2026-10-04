import { describe, expect, it } from "vitest";
import {
  dailyBusinessTax,
  taxAmountForDays,
} from "../src/modules/businesses/tax-math";

describe("dailyBusinessTax", () => {
  it("0.1% от цены", () => {
    expect(dailyBusinessTax(500_000)).toBe(500);
  });

  it("минимум 1$", () => {
    expect(dailyBusinessTax(50)).toBe(1);
  });
});

describe("taxAmountForDays", () => {
  it("умножает дневной налог", () => {
    expect(taxAmountForDays(500_000, 7)).toBe(3500);
  });
});
