import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { registerCommand } from "../commands/registry";
import {
  getOrganization,
  ORG_ARMY_ID,
  ORG_FBI_ID,
  ORG_HOSPITAL_ID,
  ORG_LSPD_ID,
  ORG_POLICE_ID,
} from "../org";
import {
  getWarehouse,
  warehouseUsesLock,
  WAREHOUSE_IDS,
  WAREHOUSE_MINE_ID,
  type WarehouseRecord,
} from "../warehouse";
import { hasAdminAccess } from "./session";

export const WAREHOUSE_LIST_DIALOG_ID = 57;
export const WAREHOUSE_INFO_DIALOG_ID = 58;

const MIN_ADMIN_LEVEL = 5;
const DIALOG_STYLE_MSGBOX = 0;
const DIALOG_STYLE_LIST = 2;

const AMMO_ONLY_IDS = new Set<number>([
  ORG_ARMY_ID,
  ORG_POLICE_ID,
  ORG_LSPD_ID,
  ORG_FBI_ID,
]);

export function bindAdminWarehouse(): void {
  registerCommand(
    "warehouse",
    "Состояние складов организаций",
    (player) => {
      if (!hasAdminAccess(player, MIN_ADMIN_LEVEL)) {
        return;
      }

      showWarehouseList(player);
    },
    true
  );

  omp.on("dialogResponse", (player, dialogId, response, listItem, inputText) => {
    if (Number(dialogId) !== WAREHOUSE_LIST_DIALOG_ID) {
      return;
    }

    onListResponse(player, Number(response), Number(listItem), String(inputText ?? ""));
  });
}

function showWarehouseList(player: Player): void {
  const lines = WAREHOUSE_IDS.map((orgId, index) => `${index + 1}. ${warehouseName(orgId)}`);

  try {
    Dialog.show(
      player,
      WAREHOUSE_LIST_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Склады",
      lines.join("\n"),
      "Выбрать",
      "Отмена"
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть список складов.");
  }
}

function onListResponse(
  player: Player,
  response: number,
  listItem: number,
  inputText: string
): void {
  if (!hasAdminAccess(player, MIN_ADMIN_LEVEL) || response === 0) {
    return;
  }

  const orgId = pickWarehouseId(listItem, inputText);
  if (orgId === null) {
    return;
  }

  showWarehouseInfo(player, orgId);
}

function showWarehouseInfo(player: Player, orgId: number): void {
  const record = getWarehouse(orgId) ?? emptyRecord(orgId);

  try {
    Dialog.show(
      player,
      WAREHOUSE_INFO_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      warehouseName(orgId),
      formatWarehouseInfo(record),
      "Закрыть",
      ""
    );
  } catch {
    player.sendClientMessage(Color.error, "Не удалось открыть склад.");
  }
}

function formatWarehouseInfo(record: WarehouseRecord): string {
  const lines: string[] = [];

  if (record.orgId === WAREHOUSE_MINE_ID) {
    lines.push(`Металл: ${record.metal}`);
  } else if (record.orgId === ORG_HOSPITAL_ID) {
    lines.push(`Медпрепараты: ${record.meds}`);
  } else if (AMMO_ONLY_IDS.has(record.orgId)) {
    lines.push(`Патроны: ${record.ammo}`);
  } else if (warehouseUsesLock(record.orgId)) {
    lines.push(`Патроны: ${record.ammo}`);
    lines.push(`Металл: ${record.metal}`);
    lines.push(`Наркотики: ${record.drugs}`);
    lines.push("");
    lines.push(record.isLocked ? "Склад закрыт" : "Склад открыт");
  } else {
    lines.push(`Патроны: ${record.ammo}`);
    lines.push(`Медпрепараты: ${record.meds}`);
    lines.push(`Металл: ${record.metal}`);
    lines.push(`Наркотики: ${record.drugs}`);
  }

  return lines.join("\n");
}

function warehouseName(orgId: number): string {
  if (orgId === WAREHOUSE_MINE_ID) {
    return "Шахта";
  }

  return getOrganization(orgId)?.name ?? `Склад #${orgId}`;
}

function pickWarehouseId(listItem: number, inputText: string): number | null {
  const byIndex = WAREHOUSE_IDS[listItem];
  if (byIndex !== undefined) {
    return byIndex;
  }

  const raw = inputText.replace(/^\d+\.\s*/, "").trim().toLowerCase();
  return (
    WAREHOUSE_IDS.find((id) => warehouseName(id).toLowerCase() === raw) ?? null
  );
}

function emptyRecord(orgId: number): WarehouseRecord {
  return {
    orgId,
    ammo: 0,
    meds: 0,
    metal: 0,
    drugs: 0,
    isLocked: warehouseUsesLock(orgId),
  };
}
