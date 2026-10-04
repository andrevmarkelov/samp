import { describe, expect, it } from "vitest";
import {
  dailyHouseRent,
  formatRentDate,
  rentAmountForDays,
  rentDaysLeftLabel,
} from "../src/modules/houses/rent-math";

describe("dailyHouseRent", () => {
  it("0.1% от цены", () => {
    expect(dailyHouseRent(1_000_000)).toBe(1000);
  });

  it("минимум 1$", () => {
    expect(dailyHouseRent(100)).toBe(1);
  });
});

describe("rentAmountForDays", () => {
  it("умножает дневную ставку", () => {
    expect(rentAmountForDays(1_000_000, 3)).toBe(3000);
  });
});

describe("formatRentDate", () => {
  it("null → не оплачено", () => {
    expect(formatRentDate(null)).toBe("не оплачено");
  });

  it("ISO → дд.мм.гггг", () => {
    expect(formatRentDate("2026-10-04")).toBe("04.10.2026");
  });
});

describe("rentDaysLeftLabel", () => {
  it("склоняет день/дня/дней", () => {
    expect(rentDaysLeftLabel(1)).toBe("день");
    expect(rentDaysLeftLabel(2)).toBe("дня");
    expect(rentDaysLeftLabel(5)).toBe("дней");
    expect(rentDaysLeftLabel(11)).toBe("дней");
    expect(rentDaysLeftLabel(21)).toBe("день");
  });
});
