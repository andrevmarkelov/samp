import { omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { playerId } from "../../shared/player";
import { byGender } from "../auth/gender";
import { getAccount } from "../auth/session";
import { formatMuteLeft, remainingMuteMs } from "../chat/mute";
import { isJailed } from "../prison/sentence";
import { registerCommand } from "./registry";

const LABEL_MS = 4000;
const LABEL_OFFSET_Z = 0.7;
const LABEL_DRAW_DISTANCE = 20;

type WatchLabel = {
  label: TextLabel;
  timer: ReturnType<typeof setTimeout>;
};

const labels = new Map<number, WatchLabel>();

registerCommand("time", "Посмотреть время, мут и срок", (player) => {
  const account = getAccount(player);
  if (!account) {
    player.sendClientMessage(Color.error, "Сначала войди в аккаунт.");
    return;
  }

  player.sendClientMessage(Color.info, `Время: ${formatClock()}.`);

  const muteLeft = remainingMuteMs(player);
  if (muteLeft !== null) {
    player.sendClientMessage(
      Color.error,
      `У вас мут. Осталось: ${formatMuteLeft(muteLeft)}.`
    );
  }

  if (isJailed(player)) {
    const left = getAccount(player)?.jailSeconds ?? 0;
    player.sendClientMessage(
      Color.error,
      `Вы в тюрьме. Осталось: ${formatMuteLeft(left * 1000)}.`
    );
  }

  const verb = byGender(account.gender, "Посмотрел", "Посмотрела");
  showWatchLabel(player, `${verb} на часы.`);
});

export function bindTimeLabels(): void {
  omp.on("playerDisconnect", (player) => {
    hideWatchLabel(player);
  });
}

function formatClock(): string {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function showWatchLabel(player: Player, text: string): void {
  hideWatchLabel(player);

  const id = playerId(player);
  if (id === null) {
    return;
  }

  try {
    const pos = player.getPos();
    const label = new TextLabel(
      text,
      Color.action,
      pos.x,
      pos.y,
      pos.z + LABEL_OFFSET_Z,
      LABEL_DRAW_DISTANCE,
      player.getVirtualWorld(),
      false
    );
    label.attachToPlayer(player, 0, 0, LABEL_OFFSET_Z);

    const timer = setTimeout(() => {
      hideWatchLabelById(id);
    }, LABEL_MS);

    labels.set(id, { label, timer });
  } catch {
    // Слот уже невалиден.
  }
}

function hideWatchLabel(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  hideWatchLabelById(id);
}

function hideWatchLabelById(id: number): void {
  const current = labels.get(id);
  if (!current) {
    return;
  }

  labels.delete(id);
  clearTimeout(current.timer);
  try {
    current.label.destroy();
  } catch {
    // Уже снята.
  }
}
