import type { RowDataPacket } from "mysql2/promise";
import { execute, getPool, isDatabaseReady, query } from "../../shared/database";
import {
  ORG_ARMY_ID,
  ORG_AZTECAS_ID,
  ORG_BALLAS_ID,
  ORG_FBI_ID,
  ORG_GROVE_ID,
  ORG_HOSPITAL_ID,
  ORG_LCN_ID,
  ORG_LSPD_ID,
  ORG_POLICE_ID,
  ORG_RIFA_ID,
  ORG_RUSSIAN_MAFIA_ID,
  ORG_VAGOS_ID,
  ORG_YAKUZA_ID,
} from "../org";

/** Склад шахты: не орган, зарезервированный org_id = 0. */
export const WAREHOUSE_MINE_ID = 0;

/** Все склады: шахта (0) + органы. */
export const WAREHOUSE_IDS: readonly number[] = [
  WAREHOUSE_MINE_ID,
  ORG_ARMY_ID,
  ORG_HOSPITAL_ID,
  ORG_POLICE_ID,
  ORG_LSPD_ID,
  ORG_FBI_ID,
  ORG_GROVE_ID,
  ORG_BALLAS_ID,
  ORG_VAGOS_ID,
  ORG_RIFA_ID,
  ORG_AZTECAS_ID,
  ORG_LCN_ID,
  ORG_YAKUZA_ID,
  ORG_RUSSIAN_MAFIA_ID,
];

/** Замок склада только у банд и мафий. */
export const WAREHOUSE_LOCKABLE_IDS: ReadonlySet<number> = new Set([
  ORG_GROVE_ID,
  ORG_BALLAS_ID,
  ORG_VAGOS_ID,
  ORG_RIFA_ID,
  ORG_AZTECAS_ID,
  ORG_LCN_ID,
  ORG_YAKUZA_ID,
  ORG_RUSSIAN_MAFIA_ID,
]);

export function warehouseUsesLock(orgId: number): boolean {
  return WAREHOUSE_LOCKABLE_IDS.has(orgId);
}

const CREATE_WAREHOUSES_SQL = `
CREATE TABLE IF NOT EXISTS warehouses (
  org_id SMALLINT UNSIGNED NOT NULL,
  ammo INT UNSIGNED NOT NULL DEFAULT 0,
  meds INT UNSIGNED NOT NULL DEFAULT 0,
  metal INT UNSIGNED NOT NULL DEFAULT 0,
  drugs INT UNSIGNED NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const COLUMN_MIGRATIONS = [
  { name: "ammo", sql: "ammo INT UNSIGNED NOT NULL DEFAULT 0 AFTER org_id" },
  { name: "meds", sql: "meds INT UNSIGNED NOT NULL DEFAULT 0 AFTER ammo" },
  { name: "metal", sql: "metal INT UNSIGNED NOT NULL DEFAULT 0 AFTER meds" },
  { name: "drugs", sql: "drugs INT UNSIGNED NOT NULL DEFAULT 0 AFTER metal" },
  {
    name: "is_locked",
    sql: "is_locked TINYINT(1) NOT NULL DEFAULT 1 AFTER drugs",
  },
] as const;

export type WarehouseRecord = {
  orgId: number;
  ammo: number;
  meds: number;
  metal: number;
  drugs: number;
  isLocked: boolean;
};

type WarehouseRow = RowDataPacket & {
  org_id: number;
  ammo: number;
  meds: number;
  metal: number;
  drugs: number;
  is_locked: number;
};

const cache = new Map<number, WarehouseRecord>();

export async function ensureWarehousesTable(): Promise<void> {
  await getPool().query(CREATE_WAREHOUSES_SQL);

  for (const column of COLUMN_MIGRATIONS) {
    if (await columnExists(column.name)) {
      continue;
    }

    await getPool().query(`ALTER TABLE warehouses ADD COLUMN ${column.sql}`);
  }

  await seedWarehouses();
  await unlockNonLockableWarehouses();
  await loadWarehousesCache();
}

export function getWarehouse(orgId: number): WarehouseRecord | null {
  return cache.get(orgId) ?? null;
}

export function listWarehouses(): readonly WarehouseRecord[] {
  return [...cache.values()];
}

/** Добавить металл на склад (руда → металл 1:1). Обновляет кэш и БД. */
export function addWarehouseMetal(orgId: number, amount: number): number {
  const add = Math.max(0, Math.floor(amount));
  if (add <= 0) {
    return getWarehouse(orgId)?.metal ?? 0;
  }

  let record = cache.get(orgId);
  if (!record) {
    record = {
      orgId,
      ammo: 0,
      meds: 0,
      metal: 0,
      drugs: 0,
      isLocked: warehouseUsesLock(orgId),
    };
    cache.set(orgId, record);
  }

  record.metal += add;
  void persistMetalAdd(orgId, add);
  return record.metal;
}

export function addMineMetal(amount: number): number {
  return addWarehouseMetal(WAREHOUSE_MINE_ID, amount);
}

async function persistMetalAdd(orgId: number, amount: number): Promise<void> {
  if (!isDatabaseReady() || amount <= 0) {
    return;
  }

  try {
    const result = await execute(
      "UPDATE warehouses SET metal = metal + ? WHERE org_id = ?",
      [amount, orgId]
    );
    if (result.affectedRows > 0) {
      return;
    }

    await execute(
      `INSERT INTO warehouses (org_id, ammo, meds, metal, drugs, is_locked)
       VALUES (?, 0, 0, ?, 0, ?)
       ON DUPLICATE KEY UPDATE metal = metal + VALUES(metal)`,
      [orgId, amount, warehouseUsesLock(orgId) ? 1 : 0]
    );
  } catch {
    // Кэш уже обновлён; при следующем старте можно сверить.
  }
}

async function columnExists(column: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'warehouses'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  );
  return rows.length > 0;
}

async function seedWarehouses(): Promise<void> {
  if (WAREHOUSE_IDS.length === 0) {
    return;
  }

  const placeholders = WAREHOUSE_IDS.map(() => "(?, 0, 0, 0, 0, ?)").join(", ");
  const params: number[] = [];
  for (const orgId of WAREHOUSE_IDS) {
    params.push(orgId, warehouseUsesLock(orgId) ? 1 : 0);
  }

  await getPool().query(
    `INSERT IGNORE INTO warehouses (org_id, ammo, meds, metal, drugs, is_locked)
     VALUES ${placeholders}`,
    params
  );
}

/** Гос/шахта: замок не используется — всегда открыт (0). */
async function unlockNonLockableWarehouses(): Promise<void> {
  const openIds = WAREHOUSE_IDS.filter((id) => !warehouseUsesLock(id));
  if (openIds.length === 0) {
    return;
  }

  const placeholders = openIds.map(() => "?").join(", ");
  await getPool().query(
    `UPDATE warehouses SET is_locked = 0 WHERE org_id IN (${placeholders})`,
    openIds
  );
}

async function loadWarehousesCache(): Promise<void> {
  const rows = await query<WarehouseRow>(
    "SELECT org_id, ammo, meds, metal, drugs, is_locked FROM warehouses"
  );

  cache.clear();
  for (const row of rows) {
    const orgId = Number(row.org_id);
    if (!Number.isInteger(orgId) || orgId < 0) {
      continue;
    }

    cache.set(orgId, {
      orgId,
      ammo: Math.max(0, Math.floor(Number(row.ammo) || 0)),
      meds: Math.max(0, Math.floor(Number(row.meds) || 0)),
      metal: Math.max(0, Math.floor(Number(row.metal) || 0)),
      drugs: Math.max(0, Math.floor(Number(row.drugs) || 0)),
      isLocked: Number(row.is_locked) !== 0,
    });
  }
}
