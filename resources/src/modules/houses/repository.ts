import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, getPool, query } from "../../shared/database";
import { computePaidUntil, dailyHouseRent, parseRentDate } from "./rent-math";

export type PurchaseHouseResult =
  | { ok: true; cashLeft: number }
  | { ok: false; reason: "not_found" | "sold" | "owned" | "funds" | "db" };

export type PurchaseMedkitResult =
  | { ok: true; cashLeft: number }
  | { ok: false; reason: "not_found" | "owner" | "exists" | "funds" | "db" };

export type SellHouseResult =
  | { ok: true; cashLeft: number; price: number }
  | { ok: false; reason: "not_found" | "owner" | "db" };

export type PayHouseRentResult =
  | { ok: true; bankLeft: number; paidUntil: string; amount: number }
  | { ok: false; reason: "not_found" | "owner" | "funds" | "db" };

export type AdminVacateHouseResult =
  | { ok: true; wasOccupied: boolean; previousOwnerId: number | null }
  | { ok: false; reason: "not_found" | "db" };

const CREATE_HOUSES_SQL = `
CREATE TABLE IF NOT EXISTS houses (
  id SMALLINT UNSIGNED NOT NULL,
  owner_id INT UNSIGNED NULL DEFAULT NULL,
  entrance_x FLOAT NOT NULL,
  entrance_y FLOAT NOT NULL,
  entrance_z FLOAT NOT NULL,
  interior_x FLOAT NOT NULL,
  interior_y FLOAT NOT NULL,
  interior_z FLOAT NOT NULL,
  vehicle_x FLOAT NOT NULL,
  vehicle_y FLOAT NOT NULL,
  vehicle_z FLOAT NOT NULL,
  vehicle_angle FLOAT NOT NULL,
  price INT UNSIGNED NOT NULL,
  interior_id SMALLINT UNSIGNED NOT NULL,
  has_medkit TINYINT(1) NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 1,
  class_id TINYINT UNSIGNED NOT NULL DEFAULT 0,
  rent_paid_until DATE NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_houses_owner_id (owner_id),
  CONSTRAINT fk_houses_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export type HouseRecord = {
  id: number;
  ownerId: number | null;
  ownerName: string | null;
  entranceX: number;
  entranceY: number;
  entranceZ: number;
  interiorX: number;
  interiorY: number;
  interiorZ: number;
  vehicleX: number;
  vehicleY: number;
  vehicleZ: number;
  vehicleAngle: number;
  price: number;
  interiorId: number;
  hasMedkit: boolean;
  isLocked: boolean;
  classId: number;
  rentPaidUntil: string | null;
};

type HouseRow = RowDataPacket & {
  id: number;
  owner_id: number | null;
  owner_name: string | null;
  entrance_x: number;
  entrance_y: number;
  entrance_z: number;
  interior_x: number;
  interior_y: number;
  interior_z: number;
  vehicle_x: number;
  vehicle_y: number;
  vehicle_z: number;
  vehicle_angle: number;
  price: number;
  interior_id: number;
  has_medkit: number;
  is_locked: number;
  class_id: number;
  rent_paid_until: Date | string | null;
};

let cachedHouses: HouseRecord[] = [];

export function listHouses(): readonly HouseRecord[] {
  return cachedHouses;
}

export function getHouse(houseId: number): HouseRecord | undefined {
  return cachedHouses.find((house) => house.id === houseId);
}

export function findOwnedHouse(userId: number): HouseRecord | undefined {
  return cachedHouses.find((house) => house.ownerId === userId);
}

export function setHouseOwner(
  houseId: number,
  ownerId: number,
  ownerName: string
): HouseRecord | null {
  const house = cachedHouses.find((item) => item.id === houseId);
  if (!house) {
    return null;
  }

  house.ownerId = ownerId;
  house.ownerName = ownerName;
  return house;
}

export function setHouseLock(houseId: number, isLocked: boolean): void {
  const house = cachedHouses.find((item) => item.id === houseId);
  if (!house) {
    return;
  }

  house.isLocked = isLocked;
}

export function setHouseMedkit(houseId: number, hasMedkit: boolean): void {
  const house = cachedHouses.find((item) => item.id === houseId);
  if (!house) {
    return;
  }

  house.hasMedkit = hasMedkit;
}

export function clearHouseForSale(houseId: number): HouseRecord | null {
  const house = cachedHouses.find((item) => item.id === houseId);
  if (!house) {
    return null;
  }

  house.ownerId = null;
  house.ownerName = null;
  house.hasMedkit = false;
  house.isLocked = true;
  house.rentPaidUntil = null;
  return house;
}

export function setHouseRentPaidUntil(houseId: number, paidUntil: string | null): void {
  const house = cachedHouses.find((item) => item.id === houseId);
  if (!house) {
    return;
  }

  house.rentPaidUntil = paidUntil;
}

export async function sellHouseToState(
  houseId: number,
  ownerId: number
): Promise<SellHouseResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [houseRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price FROM houses WHERE id = ? LIMIT 1 FOR UPDATE",
      [houseId]
    );
    const houseRow = houseRows[0];
    if (!houseRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(houseRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const price = Math.max(0, Math.floor(Number(houseRow.price)));
    const [houseUpdate] = await conn.query<ResultSetHeader>(
      `UPDATE houses
       SET owner_id = NULL, has_medkit = 0, is_locked = 1, rent_paid_until = NULL
       WHERE id = ? AND owner_id = ?`,
      [houseId, ownerId]
    );
    if (houseUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    const money = Math.max(0, Math.floor(Number(userRows[0]?.money ?? 0)));
    const maxMoney = 2_147_483_647;
    const cashLeft = Math.min(maxMoney, money + price);

    await conn.query("UPDATE users SET money = ? WHERE id = ?", [cashLeft, ownerId]);
    await conn.commit();
    return { ok: true, cashLeft, price };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function saveHouseLock(
  houseId: number,
  ownerId: number,
  isLocked: boolean
): Promise<boolean> {
  const result = await execute(
    "UPDATE houses SET is_locked = ? WHERE id = ? AND owner_id = ?",
    [isLocked ? 1 : 0, houseId, ownerId]
  );
  return result.affectedRows === 1;
}

export async function purchaseHouseMedkit(
  houseId: number,
  ownerId: number,
  price: number
): Promise<PurchaseMedkitResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [houseRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, has_medkit FROM houses WHERE id = ? LIMIT 1 FOR UPDATE",
      [houseId]
    );
    const houseRow = houseRows[0];
    if (!houseRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(houseRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }
    if (Number(houseRow.has_medkit) !== 0) {
      await conn.rollback();
      return { ok: false, reason: "exists" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    const money = Math.max(0, Math.floor(Number(userRows[0]?.money ?? 0)));
    if (money < price) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const cashLeft = money - price;
    const [medkitUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE houses SET has_medkit = 1 WHERE id = ? AND owner_id = ? AND has_medkit = 0",
      [houseId, ownerId]
    );
    if (medkitUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "exists" };
    }

    await conn.query("UPDATE users SET money = ? WHERE id = ?", [cashLeft, ownerId]);
    await conn.commit();
    return { ok: true, cashLeft };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function purchaseHouse(
  houseId: number,
  buyerId: number
): Promise<PurchaseHouseResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [ownedRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM houses WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [buyerId]
    );
    if (ownedRows.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "owned" };
    }

    const [houseRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price FROM houses WHERE id = ? LIMIT 1 FOR UPDATE",
      [houseId]
    );
    const houseRow = houseRows[0];
    if (!houseRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (houseRow.owner_id !== null) {
      await conn.rollback();
      return { ok: false, reason: "sold" };
    }

    const price = Number(houseRow.price);
    if (!Number.isInteger(price) || price < 0) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [buyerId]
    );
    const money = Math.max(0, Math.floor(Number(userRows[0]?.money ?? 0)));
    if (money < price) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const cashLeft = money - price;
    const [houseUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE houses SET owner_id = ?, rent_paid_until = CURDATE() WHERE id = ? AND owner_id IS NULL",
      [buyerId, houseId]
    );
    if (houseUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "sold" };
    }

    await conn.query("UPDATE users SET money = ? WHERE id = ?", [cashLeft, buyerId]);
    await conn.commit();
    return { ok: true, cashLeft };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function payHouseRent(
  ownerId: number,
  houseId: number,
  days: number
): Promise<PayHouseRentResult> {
  if (!Number.isInteger(days) || days < 1) {
    return { ok: false, reason: "db" };
  }

  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [houseRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price, rent_paid_until FROM houses WHERE id = ? LIMIT 1 FOR UPDATE",
      [houseId]
    );
    const houseRow = houseRows[0];
    if (!houseRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(houseRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const price = Math.max(0, Math.floor(Number(houseRow.price)));
    const amount = dailyHouseRent(price) * days;
    const currentPaidUntil = parseRentDate(houseRow.rent_paid_until);
    const paidUntil = computePaidUntil(currentPaidUntil, days);

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT bank FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    const bank = Math.max(0, Math.floor(Number(userRows[0]?.bank ?? 0)));
    if (bank < amount) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const bankLeft = bank - amount;
    const [rentUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE houses SET rent_paid_until = ? WHERE id = ? AND owner_id = ?",
      [paidUntil, houseId, ownerId]
    );
    if (rentUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    await conn.query("UPDATE users SET bank = ? WHERE id = ?", [bankLeft, ownerId]);
    await conn.commit();
    return { ok: true, bankLeft, paidUntil, amount };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function adminVacateHouse(houseId: number): Promise<AdminVacateHouseResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id FROM houses WHERE id = ? LIMIT 1 FOR UPDATE",
      [houseId]
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }

    const previousOwnerId =
      row.owner_id === null || row.owner_id === undefined ? null : Number(row.owner_id);
    const wasOccupied = previousOwnerId !== null;

    await conn.query(
      `UPDATE houses
       SET owner_id = NULL, has_medkit = 0, is_locked = 1, rent_paid_until = NULL
       WHERE id = ?`,
      [houseId]
    );

    await conn.commit();
    return { ok: true, wasOccupied, previousOwnerId };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function forfeitExpiredHouses(): Promise<number[]> {
  const conn = await getPool().getConnection();
  const forfeited: number[] = [];

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, owner_id
       FROM houses
       WHERE owner_id IS NOT NULL
         AND (rent_paid_until IS NULL OR rent_paid_until < CURDATE())
       FOR UPDATE`
    );

    for (const row of rows) {
      const houseId = Number(row.id);
      const ownerId = Number(row.owner_id);
      if (!Number.isInteger(houseId) || !Number.isInteger(ownerId)) {
        continue;
      }

      const [houseUpdate] = await conn.query<ResultSetHeader>(
        `UPDATE houses
         SET owner_id = NULL, has_medkit = 0, is_locked = 1, rent_paid_until = NULL
         WHERE id = ? AND owner_id = ?`,
        [houseId, ownerId]
      );
      if (houseUpdate.affectedRows === 1) {
        forfeited.push(houseId);
      }
    }

    await conn.commit();
    return forfeited;
  } catch {
    await conn.rollback();
    throw new Error("не удалось изъять просроченные дома");
  } finally {
    conn.release();
  }
}

export async function ensureHousesTable(): Promise<void> {
  await getPool().query(CREATE_HOUSES_SQL);
  await migrateHousesTable();
  await seedHouses();
  cachedHouses = await loadHouses();
}

async function migrateHousesTable(): Promise<void> {
  const rentColumnAdded = !(await houseColumnExists("rent_paid_until"));
  if (rentColumnAdded) {
    await getPool().query(
      "ALTER TABLE houses ADD COLUMN rent_paid_until DATE NULL DEFAULT NULL AFTER class_id"
    );
    await getPool().query(
      `UPDATE houses
       SET rent_paid_until = CURDATE()
       WHERE owner_id IS NOT NULL
         AND rent_paid_until IS NULL`
    );
  }

  if (!(await houseIndexExists("uq_houses_owner_id"))) {
    try {
      await getPool().query(
        "ALTER TABLE houses ADD UNIQUE KEY uq_houses_owner_id (owner_id)"
      );
    } catch {
      // Уже есть дубликаты owner_id — индекс добавит админ вручную.
    }
  }
}

async function houseIndexExists(indexName: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'houses'
       AND INDEX_NAME = ?
     LIMIT 1`,
    [indexName]
  );
  return rows.length > 0;
}

async function houseColumnExists(column: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'houses'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  );
  return rows.length > 0;
}

async function seedHouses(): Promise<void> {
  await getPool().query(loadHousesSeedSql());
}

function loadHousesSeedSql(): string {
  const seedPath = join(process.cwd(), "sql", "houses_seed.sql");
  if (!existsSync(seedPath)) {
    throw new Error("sql/houses_seed.sql не найден");
  }

  const sql = readFileSync(seedPath, "utf8").trim();
  if (!sql.toUpperCase().startsWith("INSERT INTO HOUSES")) {
    throw new Error("seed houses повреждён");
  }

  return sql;
}

export async function reloadHouses(): Promise<HouseRecord[]> {
  cachedHouses = await loadHouses();
  return cachedHouses;
}

async function loadHouses(): Promise<HouseRecord[]> {
  const rows = await query<HouseRow>(
    `SELECT
      h.id,
      h.owner_id,
      u.name AS owner_name,
      h.entrance_x,
      h.entrance_y,
      h.entrance_z,
      h.interior_x,
      h.interior_y,
      h.interior_z,
      h.vehicle_x,
      h.vehicle_y,
      h.vehicle_z,
      h.vehicle_angle,
      h.price,
      h.interior_id,
      h.has_medkit,
      h.is_locked,
      h.class_id,
      h.rent_paid_until
    FROM houses h
    LEFT JOIN users u ON u.id = h.owner_id
    ORDER BY h.id`
  );

  const houses: HouseRecord[] = [];

  for (const row of rows) {
    const id = Number(row.id);
    const ownerId = row.owner_id === null ? null : Number(row.owner_id);
    const ownerName =
      ownerId === null || row.owner_name === null || row.owner_name === ""
        ? null
        : String(row.owner_name);
    const entranceX = Number(row.entrance_x);
    const entranceY = Number(row.entrance_y);
    const entranceZ = Number(row.entrance_z);
    const interiorX = Number(row.interior_x);
    const interiorY = Number(row.interior_y);
    const interiorZ = Number(row.interior_z);
    const vehicleX = Number(row.vehicle_x);
    const vehicleY = Number(row.vehicle_y);
    const vehicleZ = Number(row.vehicle_z);
    const vehicleAngle = Number(row.vehicle_angle);
    const price = Number(row.price);
    const interiorId = Number(row.interior_id);
    const classId = Number(row.class_id);

    if (
      !Number.isInteger(id) ||
      (ownerId !== null && !Number.isInteger(ownerId)) ||
      !Number.isFinite(entranceX) ||
      !Number.isFinite(entranceY) ||
      !Number.isFinite(entranceZ) ||
      !Number.isInteger(price) ||
      !Number.isInteger(interiorId) ||
      !Number.isInteger(classId)
    ) {
      continue;
    }

    houses.push({
      id,
      ownerId,
      ownerName,
      entranceX,
      entranceY,
      entranceZ,
      interiorX,
      interiorY,
      interiorZ,
      vehicleX,
      vehicleY,
      vehicleZ,
      vehicleAngle,
      price,
      interiorId,
      hasMedkit: Number(row.has_medkit) !== 0,
      isLocked: Number(row.is_locked) !== 0,
      classId,
      rentPaidUntil: parseRentDate(row.rent_paid_until),
    });
  }

  return houses;
}
