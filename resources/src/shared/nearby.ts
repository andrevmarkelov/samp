import { omp, type Player } from "@omp-node/core";
import { isAuthenticated } from "../modules/auth/session";
import {
  CHAT_MAX_LENGTH,
  CLIENT_MESSAGE_MAX,
  clipClientMessage,
  sanitizeChatText,
} from "./chat-text";
import { isPlayerActive } from "./player";

export const CHAT_RADIUS = 20;
export const WHISPER_RADIUS = 5;
export const SHOUT_RADIUS = 60;
export {
  CHAT_MAX_LENGTH,
  CLIENT_MESSAGE_MAX,
  clipClientMessage,
  sanitizeChatText,
};

export function arePlayersNearby(source: Player, other: Player, radius: number): boolean {
  try {
    if (source.getVirtualWorld() !== other.getVirtualWorld()) {
      return false;
    }

    if (source.getInterior() !== other.getInterior()) {
      return false;
    }

    const pos = source.getPos();
    return other.getDistanceFromPoint(pos.x, pos.y, pos.z) <= radius;
  } catch {
    return false;
  }
}

export function sendNearby(
  source: Player,
  radius: number,
  color: number,
  text: string
): void {
  let x = 0;
  let y = 0;
  let z = 0;
  let world = 0;
  let interior = 0;

  try {
    const pos = source.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
    world = source.getVirtualWorld();
    interior = source.getInterior();
  } catch {
    source.sendClientMessage(color, text);
    return;
  }

  omp.players.forEach((other) => {
    if (!isPlayerActive(other) || !isAuthenticated(other)) {
      return;
    }

    try {
      if (other.getVirtualWorld() !== world) {
        return;
      }

      if (other.getInterior() !== interior) {
        return;
      }

      if (other.getDistanceFromPoint(x, y, z) > radius) {
        return;
      }

      other.sendClientMessage(color, text);
    } catch {
      // Слот пустой или игрок уже вышел.
    }
  });
}
