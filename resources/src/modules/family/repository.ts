import type { RowDataPacket } from "mysql2/promise";
import { execute, getPool, query } from "../../shared/database";
import {
  clearFamiliesCache,
  findFamilyInCacheByName,
  getFamily,
  listFamilies,
  removeFamilyFromCache,
  setFamilyInCache,
} from "./catalog";
import { ensureFamilyHealPickup, removeFamilyHealPickup } from "./heal";
import { ensureFamilyHomeExit, removeFamilyHomeExit } from "./home";
import { ensureFamilyStockDisplay, removeFamilyStockDisplay } from "./stock-display";
import type { FamilyRecord } from "./types";

export { getFamily, listFamilies } from "./catalog";

const CREATE_FAMILIES_SQL = `
CREATE TABLE IF NOT EXISTS families (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(24) NOT NULL,
  description VARCHAR(128) NOT NULL DEFAULT '',
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  exp INT UNSIGNED NOT NULL DEFAULT 0,
  owner_id INT UNSIGNED NOT NULL,
  ammo INT UNSIGNED NOT NULL DEFAULT 0,
  metal INT UNSIGNED NOT NULL DEFAULT 0,
  drugs INT UNSIGNED NOT NULL DEFAULT 0,
  money INT UNSIGNED NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_families_name (name),
  KEY idx_families_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const COLUMN_MIGRATIONS = [
  { name: "description", sql: "description VARCHAR(128) NOT NULL DEFAULT '' AFTER name" },
  { name: "level", sql: "level SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER description" },
  { name: "exp", sql: "exp INT UNSIGNED NOT NULL DEFAULT 0 AFTER level" },
  { name: "owner_id", sql: "owner_id INT UNSIGNED NOT NULL AFTER exp" },
  { name: "ammo", sql: "ammo INT UNSIGNED NOT NULL DEFAULT 0 AFTER owner_id" },
  { name: "metal", sql: "metal INT UNSIGNED NOT NULL DEFAULT 0 AFTER ammo" },
  { name: "drugs", sql: "drugs INT UNSIGNED NOT NULL DEFAULT 0 AFTER metal" },
  { name: "money", sql: "money INT UNSIGNED NOT NULL DEFAULT 0 AFTER drugs" },
  {
    name: "is_locked",
    sql: "is_locked TINYINT(1) NOT NULL DEFAULT 1 AFTER money",
  },
  {
    name: "created_at",
    sql: "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_locked",
  },
] as const;

type FamilyRow = RowDataPacket & {
  id: number;
  name: string;
  description: string;
  level: number;
  exp: number;
  owner_id: number;
  ammo: number;
  metal: number;
  drugs: number;
  money: number;
  is_locked: number;
  created_at: Date | string;
};

type StockField = "ammo" | "metal" | "drugs" | "money";

export async function ensureFamiliesTable(): Promise<void> {
  await getPool().query(CREATE_FAMILIES_SQL);

  for (const column of COLUMN_MIGRATIONS) {
    if (await columnExists(column.name)) {
      continue;
    }

    await getPool().query(`ALTER TABLE families ADD COLUMN ${column.sql}`);
  }

  await loadFamiliesCache();
}

export async function createFamily(input: {
  name: string;
  description: string;
  ownerId: number;
}): Promise<FamilyRecord> {
  const result = await execute(
    `INSERT INTO families (name, description, level, exp, owner_id, ammo, metal, drugs, money, is_locked)
     VALUES (?, ?, 1, 0, ?, 0, 0, 0, 0, 1)`,
    [input.name, input.description, input.ownerId]
  );

  const id = Number(result.insertId);
  const record: FamilyRecord = {
    id,
    name: input.name,
    description: input.description,
    level: 1,
    exp: 0,
    ownerId: input.ownerId,
    ammo: 0,
    metal: 0,
    drugs: 0,
    money: 0,
    isLocked: true,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  setFamilyInCache(record);
  ensureFamilyHomeExit(id);
  ensureFamilyStockDisplay(id);
  ensureFamilyHealPickup(id);
  return record;
}

export async function findFamilyByName(name: string): Promise<FamilyRecord | null> {
  const normalized = name.trim();
  if (!normalized) {
    return null;
  }

  const cached = findFamilyInCacheByName(normalized);
  if (cached) {
    return cached;
  }

  const rows = await query<FamilyRow>(
    "SELECT id, name, description, level, exp, owner_id, ammo, metal, drugs, money, is_locked, created_at FROM families WHERE name = ? LIMIT 1",
    [normalized]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  const record = recordFromRow(row);
  setFamilyInCache(record);
  return record;
}

export async function updateFamilyDescription(
  familyId: number,
  description: string
): Promise<boolean> {
  const record = getFamily(familyId);
  if (!record) {
    return false;
  }

  await execute("UPDATE families SET description = ? WHERE id = ?", [
    description,
    familyId,
  ]);
  record.description = description;
  return true;
}

export async function updateFamilyName(
  familyId: number,
  name: string
): Promise<boolean> {
  const record = getFamily(familyId);
  if (!record) {
    return false;
  }

  try {
    await execute("UPDATE families SET name = ? WHERE id = ?", [name, familyId]);
  } catch {
    return false;
  }

  record.name = name;
  return true;
}

export async function findUserNameById(userId: number): Promise<string | null> {
  const rows = await query<RowDataPacket>(
    "SELECT name FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const name = rows[0]?.name;
  return name ? String(name) : null;
}

export async function transferFamilyOwner(
  familyId: number,
  newOwnerId: number
): Promise<boolean> {
  const record = getFamily(familyId);
  if (!record) {
    return false;
  }

  await execute("UPDATE families SET owner_id = ? WHERE id = ?", [newOwnerId, familyId]);
  record.ownerId = newOwnerId;
  return true;
}

/**
 * Атомарная передача владельца + рангов (старый → зам, новый → босс).
 * false — семья/владелец не совпали или один из игроков не в семье.
 */
export async function transferFamilyOwnershipWithRanks(
  familyId: number,
  oldOwnerId: number,
  newOwnerId: number,
  oldOwnerRank: number,
  newOwnerRank: number
): Promise<boolean> {
  const record = getFamily(familyId);
  if (!record || record.ownerId !== oldOwnerId) {
    return false;
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [famRows] = await conn.query<RowDataPacket[]>(
      "SELECT owner_id FROM families WHERE id = ? FOR UPDATE",
      [familyId]
    );
    if (!famRows[0] || Number(famRows[0].owner_id) !== oldOwnerId) {
      await conn.rollback();
      return false;
    }

    const [memberRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM users
       WHERE family_id = ? AND id IN (?, ?)
       FOR UPDATE`,
      [familyId, oldOwnerId, newOwnerId]
    );
    if (memberRows.length !== 2) {
      await conn.rollback();
      return false;
    }

    await conn.query("UPDATE families SET owner_id = ? WHERE id = ?", [
      newOwnerId,
      familyId,
    ]);
    await conn.query(
      "UPDATE users SET family_rank = ? WHERE id = ? AND family_id = ?",
      [oldOwnerRank, oldOwnerId, familyId]
    );
    await conn.query(
      "UPDATE users SET family_rank = ? WHERE id = ? AND family_id = ?",
      [newOwnerRank, newOwnerId, familyId]
    );

    await conn.commit();
    record.ownerId = newOwnerId;
    return true;
  } catch {
    await conn.rollback();
    return false;
  } finally {
    conn.release();
  }
}

export async function deleteFamily(familyId: number): Promise<void> {
  await execute("UPDATE users SET family_id = 0, family_rank = 0 WHERE family_id = ?", [
    familyId,
  ]);
  await execute("DELETE FROM families WHERE id = ?", [familyId]);
  clearFamilyRuntime(familyId);
}

/**
 * Удалить семью только если владелец единственный член (защита от гонки leave+invite).
 */
export async function tryDeleteFamilyIfSoleMember(
  familyId: number,
  ownerId: number
): Promise<boolean> {
  const record = getFamily(familyId);
  if (!record || record.ownerId !== ownerId) {
    return false;
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [famRows] = await conn.query<RowDataPacket[]>(
      "SELECT owner_id FROM families WHERE id = ? FOR UPDATE",
      [familyId]
    );
    if (!famRows[0] || Number(famRows[0].owner_id) !== ownerId) {
      await conn.rollback();
      return false;
    }

    const [memberRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE family_id = ? FOR UPDATE",
      [familyId]
    );
    if (memberRows.length !== 1 || Number(memberRows[0]?.id) !== ownerId) {
      await conn.rollback();
      return false;
    }

    await conn.query(
      "UPDATE users SET family_id = 0, family_rank = 0 WHERE family_id = ?",
      [familyId]
    );
    await conn.query("DELETE FROM families WHERE id = ?", [familyId]);
    await conn.commit();

    clearFamilyRuntime(familyId);
    return true;
  } catch {
    await conn.rollback();
    return false;
  } finally {
    conn.release();
  }
}

function clearFamilyRuntime(familyId: number): void {
  removeFamilyFromCache(familyId);
  removeFamilyHomeExit(familyId);
  removeFamilyStockDisplay(familyId);
  removeFamilyHealPickup(familyId);
}

export async function countFamilyMembers(familyId: number): Promise<number> {
  const rows = await query<RowDataPacket>(
    "SELECT COUNT(*) AS cnt FROM users WHERE family_id = ?",
    [familyId]
  );
  return Math.max(0, Math.floor(Number(rows[0]?.cnt) || 0));
}

export function addFamilyAmmo(familyId: number, amount: number): number {
  const add = Math.max(0, Math.floor(amount));
  const record = getFamily(familyId);
  if (!record || add <= 0) {
    return record?.ammo ?? 0;
  }

  record.ammo += add;
  void persistStockAdd(familyId, "ammo", add);
  return record.ammo;
}

export function addFamilyMetal(familyId: number, amount: number): number {
  const add = Math.max(0, Math.floor(amount));
  const record = getFamily(familyId);
  if (!record || add <= 0) {
    return record?.metal ?? 0;
  }

  record.metal += add;
  void persistStockAdd(familyId, "metal", add);
  return record.metal;
}

export function addFamilyDrugs(familyId: number, amount: number): number {
  const add = Math.max(0, Math.floor(amount));
  const record = getFamily(familyId);
  if (!record || add <= 0) {
    return record?.drugs ?? 0;
  }

  record.drugs += add;
  void persistStockAdd(familyId, "drugs", add);
  return record.drugs;
}

export function addFamilyMoney(familyId: number, amount: number): number {
  const add = Math.max(0, Math.floor(amount));
  const record = getFamily(familyId);
  if (!record || add <= 0) {
    return record?.money ?? 0;
  }

  record.money += add;
  void persistStockAdd(familyId, "money", add);
  return record.money;
}

/** Добавить деньги на склад с ожиданием записи в БД. */
export async function addFamilyMoneyAwaited(
  familyId: number,
  amount: number
): Promise<number | null> {
  const add = Math.max(0, Math.floor(amount));
  const record = getFamily(familyId);
  if (!record || add <= 0) {
    return null;
  }

  record.money += add;
  try {
    await execute(`UPDATE families SET money = money + ? WHERE id = ?`, [
      add,
      familyId,
    ]);
    return record.money;
  } catch {
    record.money = Math.max(0, record.money - add);
    return null;
  }
}

export function takeFamilyAmmo(familyId: number, amount: number): boolean {
  return takeStock(familyId, "ammo", amount);
}

export function takeFamilyMetal(familyId: number, amount: number): boolean {
  return takeStock(familyId, "metal", amount);
}

export function takeFamilyDrugs(familyId: number, amount: number): boolean {
  return takeStock(familyId, "drugs", amount);
}

export function takeFamilyMoney(familyId: number, amount: number): boolean {
  return takeStock(familyId, "money", amount);
}

/** Списать деньги со склада: условный UPDATE + сверка affectedRows. */
export async function takeFamilyMoneyAwaited(
  familyId: number,
  amount: number
): Promise<boolean> {
  const take = Math.max(0, Math.floor(amount));
  if (take <= 0) {
    return false;
  }

  const record = getFamily(familyId);
  if (!record || record.money < take) {
    return false;
  }

  record.money -= take;
  try {
    const result = await execute(
      `UPDATE families SET money = money - ? WHERE id = ? AND money >= ?`,
      [take, familyId, take]
    );
    if (result.affectedRows === 0) {
      record.money += take;
      return false;
    }
    return true;
  } catch {
    record.money += take;
    return false;
  }
}

export function setFamilyLocked(familyId: number, locked: boolean): boolean {
  const record = getFamily(familyId);
  if (!record) {
    return false;
  }

  record.isLocked = locked;
  void execute("UPDATE families SET is_locked = ? WHERE id = ?", [
    locked ? 1 : 0,
    familyId,
  ]).catch(() => {
    // Кэш уже обновлён.
  });
  return true;
}

async function loadFamiliesCache(): Promise<void> {
  clearFamiliesCache();
  const rows = await query<FamilyRow>(
    "SELECT id, name, description, level, exp, owner_id, ammo, metal, drugs, money, is_locked, created_at FROM families"
  );

  for (const row of rows) {
    setFamilyInCache(recordFromRow(row));
  }
}

function takeStock(familyId: number, field: StockField, amount: number): boolean {
  const take = Math.max(0, Math.floor(amount));
  if (take <= 0) {
    return false;
  }

  const record = getFamily(familyId);
  if (!record || record[field] < take) {
    return false;
  }

  record[field] -= take;
  void persistStockTake(familyId, field, take);
  return true;
}

function persistStockAdd(familyId: number, field: StockField, amount: number): void {
  void execute(`UPDATE families SET ${field} = ${field} + ? WHERE id = ?`, [
    amount,
    familyId,
  ]).catch(() => {
    // Кэш уже обновлён.
  });
}

function persistStockTake(familyId: number, field: StockField, amount: number): void {
  void execute(
    `UPDATE families SET ${field} = GREATEST(0, CAST(${field} AS SIGNED) - ?) WHERE id = ?`,
    [amount, familyId]
  ).catch(() => {
    // Кэш уже обновлён.
  });
}

function recordFromRow(row: FamilyRow): FamilyRecord {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    level: Math.max(1, Math.floor(Number(row.level) || 1)),
    exp: Math.max(0, Math.floor(Number(row.exp) || 0)),
    ownerId: Math.floor(Number(row.owner_id) || 0),
    ammo: Math.max(0, Math.floor(Number(row.ammo) || 0)),
    metal: Math.max(0, Math.floor(Number(row.metal) || 0)),
    drugs: Math.max(0, Math.floor(Number(row.drugs) || 0)),
    money: Math.max(0, Math.floor(Number(row.money) || 0)),
    isLocked: Boolean(Number(row.is_locked)),
    createdAt: toIsoDate(row.created_at),
  };
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return new Date().toISOString().slice(0, 10);
  }

  return text.slice(0, 10);
}

async function columnExists(name: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'families'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}
