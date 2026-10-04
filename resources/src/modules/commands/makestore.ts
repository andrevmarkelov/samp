import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { findOwnedHouseAtInterior } from "../houses/interior";
import {
  hasHouseStore,
  saveHouseStorePosition,
  setHouseStorePosition,
} from "../houses/repository";
import { ensureHouseStoreLabel } from "../houses/store-display";
import { isJailed } from "../prison/sentence";
import { registerCommand } from "./registry";

const PLAYER_STATE_ONFOOT = 1;
const busy = new Set<number>();

registerCommand(
  "makestore",
  "Установить или переставить шкаф в своём доме",
  (player) => {
    void handleMakeStore(player);
  }
);

async function handleMakeStore(player: Player): Promise<void> {
  if (!isAuthenticated(player)) {
    player.sendClientMessage(Color.error, "Сначала войдите в аккаунт.");
    return;
  }

  const account = getAccount(player);
  const slot = playerId(player);
  if (!account || slot === null) {
    return;
  }

  if (busy.has(slot)) {
    player.sendClientMessage(Color.error, "Подождите завершения операции.");
    return;
  }

  if (isJailed(player)) {
    player.sendClientMessage(Color.error, "В тюрьме команда недоступна.");
    return;
  }

  if (account.hospitalized) {
    player.sendClientMessage(Color.error, "Сначала пройдите лечение в больнице.");
    return;
  }

  try {
    if (player.getState() !== PLAYER_STATE_ONFOOT) {
      player.sendClientMessage(Color.error, "Нужно стоять пешком.");
      return;
    }
  } catch {
    return;
  }

  const house = findOwnedHouseAtInterior(player);
  if (!house) {
    player.sendClientMessage(
      Color.error,
      "Установить шкаф можно только внутри своего дома."
    );
    return;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  try {
    const pos = player.getPos();
    x = pos.x;
    y = pos.y;
    z = pos.z;
  } catch {
    return;
  }

  const relocating = hasHouseStore(house);

  busy.add(slot);
  try {
    const ok = await saveHouseStorePosition(house.id, account.id, x, y, z);
    if (!ok) {
      player.sendClientMessage(Color.error, "Не удалось сохранить шкаф.");
      return;
    }

    setHouseStorePosition(house.id, x, y, z);
    ensureHouseStoreLabel(house.id);

    player.sendClientMessage(
      Color.info,
      relocating
        ? "Вы переставили шкаф. Управление: /use"
        : "Шкаф установлен. Управление: /use"
    );
  } finally {
    busy.delete(slot);
  }
}
