import { describe, expect, it } from "vitest";
import { formatMoney } from "../src/shared/money";

describe("formatMoney", () => {
  it("форматирует тысячи с пробелом и $", () => {
    expect(formatMoney(5000)).toBe("5 000$");
  });

  it("форматирует миллионы", () => {
    expect(formatMoney(2_000_000)).toBe("2 000 000$");
  });

  it("сохраняет минус", () => {
    expect(formatMoney(-1500)).toBe("-1 500$");
  });

  it("обрезает дробную часть", () => {
    expect(formatMoney(99.9)).toBe("99$");
  });

  it("нечисло → 0$", () => {
    expect(formatMoney(Number.NaN)).toBe("0$");
  });
});
