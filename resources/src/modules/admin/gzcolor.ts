import type { Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { GANGS, getOrganization } from "../org";
import { registerCommand } from "../commands/registry";
import { isZoneUnderCapture } from "../zones/capture";
import { findTurfAtPlayer, setGangZoneOwner } from "../zones/turf";
import { hasAdminAccess } from "./session";

const MIN_ADMIN_LEVEL = 5;

function usageLines(): string[] {
  return [
    "Использование: /gzcolor [id]",
    ...GANGS.map((gang) => `${gang.id} — ${gang.name}`),
  ];
}

function parseGangId(args: string): number | null {
  const raw = args.trim();
  if (!raw) {
    return null;
  }

  const orgId = Number(raw);
  if (!Number.isInteger(orgId)) {
    return null;
  }

  return GANGS.some((gang) => gang.id === orgId) ? orgId : null;
}

export function bindAdminGzcolor(): void {
  registerCommand(
    "gzcolor",
    "Сменить владельца гангзоны",
    (player, args) => {
      if (!hasAdminAccess(player, MIN_ADMIN_LEVEL)) {
        return;
      }

      const orgId = parseGangId(args);
      if (orgId === null) {
        for (const line of usageLines()) {
          player.sendClientMessage(Color.error, line);
        }
        return;
      }

      const turf = findTurfAtPlayer(player);
      if (!turf) {
        player.sendClientMessage(
          Color.error,
          "Встаньте на гангзону, которую хотите изменить."
        );
        return;
      }

      if (turf.orgId === orgId) {
        player.sendClientMessage(Color.error, "Эта территория уже принадлежит этой банде.");
        return;
      }

      if (isZoneUnderCapture(turf.id)) {
        player.sendClientMessage(Color.error, "Нельзя сменить владельца во время капта.");
        return;
      }

      void applyOwner(player, turf.id, orgId, turf.orgId);
    },
    true
  );
}

async function applyOwner(
  admin: Player,
  zoneId: number,
  orgId: number,
  previousOrgId: number
): Promise<void> {
  const saved = await setGangZoneOwner(zoneId, orgId);
  if (!saved) {
    admin.sendClientMessage(Color.error, "Не удалось сохранить владельца зоны.");
    return;
  }

  const nextName = getOrganization(orgId)?.name ?? "банде";
  const prevName = getOrganization(previousOrgId)?.name ?? "никому";
  admin.sendClientMessage(Color.info, `Зона #${zoneId}: ${prevName} → ${nextName}.`);
}
