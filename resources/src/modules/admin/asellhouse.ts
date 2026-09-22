import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { SERVER_TAG } from "../../shared/brand";
import { playerChatName } from "../../shared/player";
import { registerCommand } from "../commands/registry";
import { applyAdminVacatedHouse } from "../houses/rent";
import { adminVacateHouse, getHouse } from "../houses/repository";
import { getAccount } from "../auth/session";
import { hasAdminAccess } from "./session";

const MIN_ADMIN_LEVEL = 5;

function parseHouseId(args: string): number | null {
  const raw = args.trim();
  if (!/^\d+$/.test(raw) || raw.length > 5) {
    return null;
  }

  const houseId = Number(raw);
  if (!Number.isInteger(houseId) || houseId < 1) {
    return null;
  }

  return houseId;
}

export function bindAdminAsellhouse(): void {
  registerCommand(
    "asellhouse",
    "Освободить дом (продажа государству без выплаты)",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_ADMIN_LEVEL)) {
        return;
      }

      const houseId = parseHouseId(args);
      if (houseId === null) {
        player.sendClientMessage(Color.error, "Использование: /asellhouse [id дома]");
        return;
      }

      if (!getHouse(houseId)) {
        player.sendClientMessage(Color.error, "Дом с таким номером не найден.");
        return;
      }

      void vacateHouse(player, houseId);
    },
    true
  );
}

async function vacateHouse(admin: Player, houseId: number): Promise<void> {
  const account = getAccount(admin);
  if (!account) {
    return;
  }

  let result;
  try {
    result = await adminVacateHouse(houseId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    omp.log(`[${SERVER_TAG}] asellhouse ${account.name} дом ${houseId}: ${message}`);
    admin.sendClientMessage(Color.error, "Не удалось освободить дом.");
    return;
  }

  if (!result.ok) {
    if (result.reason === "not_found") {
      admin.sendClientMessage(Color.error, "Дом с таким номером не найден.");
      return;
    }
    admin.sendClientMessage(Color.error, "Не удалось освободить дом.");
    return;
  }

  applyAdminVacatedHouse(houseId);

  const label = playerChatName(admin);
  omp.log(`[${SERVER_TAG}] asellhouse ${label} освободил дом №${houseId}`);

  if (result.wasOccupied) {
    admin.sendClientMessage(
      Color.info,
      `Дом №${houseId} освобождён. Бывший владелец: id ${result.previousOwnerId}.`
    );
    return;
  }

  admin.sendClientMessage(Color.info, `Дом №${houseId} уже был свободен. Состояние обновлено.`);
}
