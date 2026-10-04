import { describe, expect, it } from "vitest";
import { Color, chatColorTag } from "../src/shared/colors";

describe("chatColorTag", () => {
  it("берёт RGB без альфы", () => {
    expect(chatColorTag(Color.white)).toBe("{FFFFFF}");
  });

  it("форматирует info", () => {
    expect(chatColorTag(Color.info)).toBe("{33CCFF}");
  });
});
