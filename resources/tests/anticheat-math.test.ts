import { describe, expect, it } from "vitest";
import { dist3, speedFromVelocity } from "../src/modules/anticheat/math";

describe("dist3", () => {
  it("считает расстояние", () => {
    expect(dist3(0, 0, 0, 3, 4, 0)).toBe(5);
  });

  it("ноль для одной точки", () => {
    expect(dist3(1, 2, 3, 1, 2, 3)).toBe(0);
  });
});

describe("speedFromVelocity", () => {
  it("нулевая скорость", () => {
    expect(speedFromVelocity(0, 0, 0)).toBe(0);
  });

  it("масштабирует hypot", () => {
    expect(speedFromVelocity(1, 0, 0)).toBe(179);
  });
});
