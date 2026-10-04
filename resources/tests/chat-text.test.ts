import { describe, expect, it } from "vitest";
import {
  CLIENT_MESSAGE_MAX,
  clipClientMessage,
  sanitizeChatText,
} from "../src/shared/chat-text";

describe("sanitizeChatText", () => {
  it("вырезает {", () => {
    expect(sanitizeChatText("привет {FF0000}мир")).toBe("привет FF0000}мир");
  });

  it("заменяет переносы на пробел", () => {
    expect(sanitizeChatText("a\nb\nc")).toBe("a b c");
    // \r\n → два пробела (каждый символ отдельно)
    expect(sanitizeChatText("a\r\nb")).toBe("a  b");
  });
});

describe("clipClientMessage", () => {
  it("не режет короткий текст", () => {
    expect(clipClientMessage("ok")).toBe("ok");
  });

  it("обрезает до CLIENT_MESSAGE_MAX", () => {
    const long = "x".repeat(CLIENT_MESSAGE_MAX + 20);
    expect(clipClientMessage(long)).toHaveLength(CLIENT_MESSAGE_MAX);
  });
});
