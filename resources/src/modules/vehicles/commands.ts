import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import { isPlayerActive, playerId } from "../../shared/player";
import { getAccount, isAuthenticated } from "../auth/session";
import { registerCommand } from "../commands/registry";
import { findOwnedHouse } from "../houses/repository";
import { findOwnedPlayerVehicle } from "./player-vehicles";
import {
  findRuntimeIdByDbId,
  getPersonalRuntime,
  parkPersonalVehicleAtHouse,
  toggleNearbyPersonalLock,
} from "./personal";
import { bindPersonalTrunk } from "./trunk";
import {
  bindPersonalVehicleSell,
  showSellPlayerInput,
  showSellStateConfirm,
} from "./sell";

export const CAR_MENU_DIALOG_ID = 86;
export const CAR_INFO_DIALOG_ID = 87;

const DIALOG_STYLE_LIST = 2;
const DIALOG_STYLE_MSGBOX = 0;
const MENU_ITEMS = [
  "Информация",
  "Припарковать",
  "Продать машину",
  "Продать машину игроку",
] as const;

const pendingMenu = new Set<number>();

export function bindPersonalVehicleCommands(): void {
  registerCommand("lock", "Открыть / закрыть свой транспорт", (player) => {
    void toggleNearbyPersonalLock(player);
  });

  registerCommand("car", "Меню личного транспорта", (player) => {
    void openCarMenu(player);
  });

  bindPersonalTrunk();
  bindPersonalVehicleSell();

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    const id = Number(dialogId);
    if (id !== CAR_MENU_DIALOG_ID && id !== CAR_INFO_DIALOG_ID) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    if (id === CAR_INFO_DIALOG_ID) {
      pendingMenu.delete(slotId);
      if (Number(response) !== 0) {
        void openCarMenu(player);
      }
      return;
    }

    pendingMenu.delete(slotId);
    if (Number(response) === 0) {
      return;
    }

    void handleCarMenuChoice(player, Number(listItem));
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      pendingMenu.delete(slotId);
    }
  });
}

async function openCarMenu(player: Player): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  const slotId = playerId(player);
  if (!account || slotId === null) {
    return;
  }

  const vehicle = await findOwnedPlayerVehicle(account.id);
  if (!vehicle) {
    player.sendClientMessage(Color.error, "У вас нет личного транспорта.");
    return;
  }

  pendingMenu.add(slotId);
  try {
    Dialog.show(
      player,
      CAR_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Личный транспорт",
      MENU_ITEMS.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    pendingMenu.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть меню транспорта.");
  }
}

async function handleCarMenuChoice(player: Player, listItem: number): Promise<void> {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const vehicle = await findOwnedPlayerVehicle(account.id);
  if (!vehicle) {
    player.sendClientMessage(Color.error, "У вас нет личного транспорта.");
    return;
  }

  if (listItem === 0) {
    let health = vehicle.health;
    let locked = vehicle.isLocked;
    const runtimeId = findRuntimeIdByDbId(vehicle.id);
    if (runtimeId !== undefined) {
      const runtime = getPersonalRuntime(runtimeId);
      if (runtime) {
        locked = runtime.locked;
      }
      try {
        const live = omp.vehicles.at(runtimeId);
        if (live) {
          health = live.getHealth();
        }
      } catch {
        // Машины уже нет в мире.
      }
    }
    showCarInfo(
      player,
      vehicle.id,
      vehicle.fuel,
      health,
      locked,
      vehicle.purchasePrice
    );
    return;
  }

  if (listItem === 1) {
    await parkAtHouse(player, vehicle);
    return;
  }

  if (listItem === 2) {
    showSellStateConfirm(player, vehicle);
    return;
  }

  if (listItem === 3) {
    showSellPlayerInput(player, vehicle);
  }
}

function showCarInfo(
  player: Player,
  id: number,
  fuel: number,
  health: number,
  locked: boolean,
  purchasePrice: number
): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  pendingMenu.add(slotId);
  const body = [
    `ID машины:\t${id}`,
    `Бензин:\t${Math.round(fuel)}`,
    `Здоровье:\t${Math.round(health)}`,
    `Статус:\t${locked ? "закрыта" : "открыта"}`,
    `Цена покупки:\t${formatMoney(purchasePrice)}`,
  ].join("\n");

  try {
    Dialog.show(
      player,
      CAR_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      "Информация о транспорте",
      body,
      "Назад",
      "Закрыть"
    );
  } catch {
    pendingMenu.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть информацию.");
  }
}

async function parkAtHouse(
  player: Player,
  vehicle: NonNullable<Awaited<ReturnType<typeof findOwnedPlayerVehicle>>>
): Promise<void> {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const house = findOwnedHouse(account.id);
  if (!house) {
    player.sendClientMessage(
      Color.error,
      "У вас нет дома. Припарковать транспорт можно только у своего дома."
    );
    return;
  }

  const spawned = await parkPersonalVehicleAtHouse(
    player,
    vehicle,
    house.vehicleX,
    house.vehicleY,
    house.vehicleZ,
    house.vehicleAngle
  );

  if (!spawned) {
    player.sendClientMessage(Color.error, "Не удалось припарковать транспорт.");
    return;
  }

  player.sendClientMessage(
    Color.tryOk,
    "Транспорт припаркован у вашего дома. Пассажиры высажены, если были в машине."
  );
}
