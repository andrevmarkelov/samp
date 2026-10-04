import { describe, expect, it } from "vitest";
import { byGender } from "../src/modules/auth/gender";

describe("byGender", () => {
  it("female → женская форма", () => {
    expect(byGender("female", "сказал", "сказала")).toBe("сказала");
  });

  it("male → мужская форма", () => {
    expect(byGender("male", "сказал", "сказала")).toBe("сказал");
  });

  it("null → мужская по умолчанию", () => {
    expect(byGender(null, "удивился", "удивилась")).toBe("удивился");
  });
});
