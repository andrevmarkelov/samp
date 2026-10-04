export const CHAT_MAX_LENGTH = 128;
export const CLIENT_MESSAGE_MAX = 144;

export function sanitizeChatText(text: string): string {
  return text.replace(/\{/g, "").replace(/[\r\n]/g, " ");
}

export function clipClientMessage(text: string): string {
  return text.slice(0, CLIENT_MESSAGE_MAX);
}
