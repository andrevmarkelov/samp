import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { execute, getPool, query } from "../../shared/database";
import {
  GANGS,
  ORG_AZTECAS_ID,
  ORG_BALLAS_ID,
  ORG_GROVE_ID,
  ORG_VAGOS_ID,
} from "../org";

const CREATE_GANG_ZONES_SQL = `
CREATE TABLE IF NOT EXISTS gang_zones (
  id SMALLINT UNSIGNED NOT NULL,
  min_x FLOAT NOT NULL,
  min_y FLOAT NOT NULL,
  max_x FLOAT NOT NULL,
  max_y FLOAT NOT NULL,
  org_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const COLUMN_MIGRATIONS = [
  { name: "min_x", sql: "min_x FLOAT NOT NULL DEFAULT 0 AFTER id" },
  { name: "min_y", sql: "min_y FLOAT NOT NULL DEFAULT 0 AFTER min_x" },
  { name: "max_x", sql: "max_x FLOAT NOT NULL DEFAULT 0 AFTER min_y" },
  { name: "max_y", sql: "max_y FLOAT NOT NULL DEFAULT 0 AFTER max_x" },
] as const;

/** Старые org_id из дампа (1–5) → текущие банды 9–13. */
const LEGACY_ORG_REMAP: ReadonlyArray<readonly [number, number]> = [
  [1, ORG_AZTECAS_ID],
  [2, ORG_BALLAS_ID],
  [3, ORG_VAGOS_ID],
  [4, ORG_GROVE_ID],
  [5, ORG_VAGOS_ID],
];

export type GangZoneRecord = {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  orgId: number;
};

type GangZoneRow = RowDataPacket & {
  id: number;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  org_id: number;
};

function isGangOrgId(orgId: number): boolean {
  return GANGS.some((gang) => gang.id === orgId);
}

export async function ensureGangZonesTable(): Promise<void> {
  await getPool().query(CREATE_GANG_ZONES_SQL);

  for (const column of COLUMN_MIGRATIONS) {
    if (await columnExists(column.name)) {
      continue;
    }

    await getPool().query(`ALTER TABLE gang_zones ADD COLUMN ${column.sql}`);
  }

  await remapLegacyOrgIds();
  await seedGangZones();
}

async function columnExists(column: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'gang_zones'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  );
  return rows.length > 0;
}

async function remapLegacyOrgIds(): Promise<void> {
  for (const [legacyId, orgId] of LEGACY_ORG_REMAP) {
    await execute("UPDATE gang_zones SET org_id = ? WHERE org_id = ?", [orgId, legacyId]);
  }
}

async function seedGangZones(): Promise<void> {
  await getPool().query(loadGangZonesSeedSql());
}

function loadGangZonesSeedSql(): string {
  const schemaPath = join(process.cwd(), "sql", "schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error("sql/schema.sql не найден");
  }

  const sql = readFileSync(schemaPath, "utf8");
  const start = sql.indexOf("INSERT INTO gang_zones");
  if (start < 0) {
    throw new Error("INSERT gang_zones не найден в schema.sql");
  }

  const end = sql.indexOf(";", start);
  const statement = (end < 0 ? sql.slice(start) : sql.slice(start, end + 1)).trim();
  if (!statement.toUpperCase().startsWith("INSERT INTO GANG_ZONES")) {
    throw new Error("seed gang_zones повреждён");
  }

  return statement;
}

export async function loadGangZones(): Promise<GangZoneRecord[]> {
  const rows = await query<GangZoneRow>(
    "SELECT id, min_x, min_y, max_x, max_y, org_id FROM gang_zones ORDER BY id"
  );
  const zones: GangZoneRecord[] = [];

  for (const row of rows) {
    const id = Number(row.id);
    const minX = Number(row.min_x);
    const minY = Number(row.min_y);
    const maxX = Number(row.max_x);
    const maxY = Number(row.max_y);
    const orgId = Number(row.org_id);
    if (
      !Number.isInteger(id) ||
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY) ||
      !Number.isInteger(orgId)
    ) {
      continue;
    }

    zones.push({ id, minX, minY, maxX, maxY, orgId });
  }

  return zones;
}

export async function saveGangZoneOwner(zoneId: number, orgId: number): Promise<void> {
  if (!isGangOrgId(orgId)) {
    throw new Error("org_id dolzhen byt' bandoy");
  }

  await execute("UPDATE gang_zones SET org_id = ? WHERE id = ?", [orgId, zoneId]);
}
