export const Color = {
  white: 0xffffffff,
  gray: 0xccccccff,
  info: 0x33ccffff,
  error: 0xff6347ff,
  action: 0xc2a2daff,
  scene: 0x9acd32ff,
  chat: 0xe6e6e6ff,
  ooc: 0xb0b0b0ff,
  tryOk: 0x33cc66ff,
  tryFail: 0xcc5555ff,
  shout: 0xffff99ff,
  whisper: 0xc8c8c8ff,
  adminChat: 0x00ffffff,
  radio: 0x33cc66ff,
  ad: 0x33cc66ff,
  adChecked: 0x2a9955ff,
  dept: 0xff4c4cff,
  govNews: 0x3399ffff,
} as const;

/** Цвет в тексте клиентского чата: {RRGGBB}. */
export function chatColorTag(color: number): string {
  const rgb = ((color >>> 8) & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  return `{${rgb}}`;
}
