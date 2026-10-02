import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, query } from "../../shared/database";
import { computePaidUntil, dailyBusinessTax } from "./tax-math";

export type PayEntranceFeeResult =
  | { ok: true; cashLeft: number; balance: number }
  | { ok: false; reason: "not_found" | "funds" | "db" };

const CREATE_BUSINESSES_SQL = `
CREATE TABLE IF NOT EXISTS businesses (
  id SMALLINT UNSIGNED NOT NULL,
  name VARCHAR(64) NOT NULL,
  owner_id INT UNSIGNED NULL DEFAULT NULL,
  type_id TINYINT UNSIGNED NOT NULL,
  entrance_x FLOAT NOT NULL,
  entrance_y FLOAT NOT NULL,
  entrance_z FLOAT NOT NULL,
  interior_id SMALLINT UNSIGNED NULL DEFAULT NULL,
  interior_x FLOAT NULL DEFAULT NULL,
  interior_y FLOAT NULL DEFAULT NULL,
  interior_z FLOAT NULL DEFAULT NULL,
  buy_pickup_x FLOAT NULL DEFAULT NULL,
  buy_pickup_y FLOAT NULL DEFAULT NULL,
  buy_pickup_z FLOAT NULL DEFAULT NULL,
  price INT UNSIGNED NOT NULL,
  entrance_fee INT UNSIGNED NOT NULL DEFAULT 0,
  balance INT NOT NULL DEFAULT 0,
  tax_paid_until DATE NULL DEFAULT NULL,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_businesses_owner_id (owner_id),
  KEY idx_businesses_type_id (type_id),
  CONSTRAINT fk_businesses_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export type BusinessRecord = {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  typeId: number;
  entranceX: number;
  entranceY: number;
  entranceZ: number;
  interiorId: number | null;
  interiorX: number | null;
  interiorY: number | null;
  interiorZ: number | null;
  buyPickupX: number | null;
  buyPickupY: number | null;
  buyPickupZ: number | null;
  price: number;
  entranceFee: number;
  balance: number;
  taxPaidUntil: string | null;
  isLocked: boolean;
};

type BusinessRow = RowDataPacket & {
  id: number;
  name: string;
  owner_id: number | null;
  owner_name: string | null;
  type_id: number;
  entrance_x: number;
  entrance_y: number;
  entrance_z: number;
  interior_id: number | null;
  interior_x: number | null;
  interior_y: number | null;
  interior_z: number | null;
  buy_pickup_x: number | null;
  buy_pickup_y: number | null;
  buy_pickup_z: number | null;
  price: number;
  entrance_fee: number;
  balance: number;
  tax_paid_until: Date | string | null;
  is_locked: number;
};

let cachedBusinesses: BusinessRecord[] = [];

export function listBusinesses(): readonly BusinessRecord[] {
  return cachedBusinesses;
}

export function getBusiness(businessId: number): BusinessRecord | undefined {
  return cachedBusinesses.find((item) => item.id === businessId);
}

export function findOwnedBusiness(userId: number): BusinessRecord | undefined {
  return cachedBusinesses.find((item) => item.ownerId === userId);
}

export function businessHasInterior(business: BusinessRecord): boolean {
  return (
    business.interiorId !== null &&
    business.interiorX !== null &&
    business.interiorY !== null &&
    business.interiorZ !== null
  );
}

export function setBusinessOwner(
  businessId: number,
  ownerId: number,
  ownerName: string
): BusinessRecord | null {
  const business = cachedBusinesses.find((item) => item.id === businessId);
  if (!business) {
    return null;
  }

  business.ownerId = ownerId;
  business.ownerName = ownerName;
  return business;
}

export function setBusinessTaxPaidUntil(businessId: number, paidUntil: string | null): void {
  const business = cachedBusinesses.find((item) => item.id === businessId);
  if (!business) {
    return;
  }

  business.taxPaidUntil = paidUntil;
}

export function clearBusinessForSale(businessId: number): BusinessRecord | null {
  const business = cachedBusinesses.find((item) => item.id === businessId);
  if (!business) {
    return null;
  }

  business.ownerId = null;
  business.ownerName = null;
  business.taxPaidUntil = null;
  business.balance = 0;
  business.isLocked = false;
  return business;
}

export function setBusinessBalance(businessId: number, balance: number): void {
  const business = cachedBusinesses.find((item) => item.id === businessId);
  if (!business) {
    return;
  }

  business.balance = balance;
}

export type PurchaseBusinessResult =
  | { ok: true; cashLeft: number }
  | { ok: false; reason: "not_found" | "sold" | "owned" | "funds" | "db" };

export type SellBusinessResult =
  | { ok: true; cashLeft: number; price: number }
  | { ok: false; reason: "not_found" | "owner" | "db" };

export type TransferBusinessResult =
  | { ok: true; buyerCashLeft: number; sellerCashLeft: number }
  | {
      ok: false;
      reason: "not_found" | "owner" | "buyer_owned" | "buyer_funds" | "db";
    };

export type PayBusinessTaxResult =
  | { ok: true; bankLeft: number; paidUntil: string; amount: number }
  | { ok: false; reason: "not_found" | "owner" | "funds" | "db" };

export type WithdrawBusinessResult =
  | { ok: true; cashLeft: number; balanceLeft: number; amount: number }
  | { ok: false; reason: "not_found" | "owner" | "funds" | "db" };

export async function purchaseBusiness(
  businessId: number,
  buyerId: number
): Promise<PurchaseBusinessResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [ownedRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM businesses WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [buyerId]
    );
    if (ownedRows.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "owned" };
    }

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (bizRow.owner_id !== null) {
      await conn.rollback();
      return { ok: false, reason: "sold" };
    }

    const price = Number(bizRow.price);
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
    const [bizUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET owner_id = ?, tax_paid_until = CURDATE() WHERE id = ? AND owner_id IS NULL",
      [buyerId, businessId]
    );
    if (bizUpdate.affectedRows !== 1) {
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

const MAX_MONEY = 2_147_483_647;

export async function sellBusinessToState(
  businessId: number,
  ownerId: number
): Promise<SellBusinessResult> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(bizRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const price = Math.max(0, Math.floor(Number(bizRow.price)));
    const [bizUpdate] = await conn.query<ResultSetHeader>(
      `UPDATE businesses
       SET owner_id = NULL, tax_paid_until = NULL, balance = 0
       WHERE id = ? AND owner_id = ?`,
      [businessId, ownerId]
    );
    if (bizUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    const money = Math.max(0, Math.floor(Number(userRows[0]?.money ?? 0)));
    const cashLeft = Math.min(MAX_MONEY, money + price);

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

export async function transferBusinessToPlayer(
  businessId: number,
  sellerId: number,
  buyerId: number,
  price: number
): Promise<TransferBusinessResult> {
  if (!Number.isInteger(price) || price < 1) {
    return { ok: false, reason: "db" };
  }

  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [ownedRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM businesses WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [buyerId]
    );
    if (ownedRows.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "buyer_owned" };
    }

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(bizRow.owner_id) !== sellerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const [buyerRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [buyerId]
    );
    const buyerMoney = Math.max(0, Math.floor(Number(buyerRows[0]?.money ?? 0)));
    if (buyerMoney < price) {
      await conn.rollback();
      return { ok: false, reason: "buyer_funds" };
    }

    const [sellerRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [sellerId]
    );
    const sellerMoney = Math.max(0, Math.floor(Number(sellerRows[0]?.money ?? 0)));
    if (sellerMoney > MAX_MONEY - price) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const buyerCashLeft = buyerMoney - price;
    const sellerCashLeft = sellerMoney + price;

    const [bizUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET owner_id = ? WHERE id = ? AND owner_id = ?",
      [buyerId, businessId, sellerId]
    );
    if (bizUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    await conn.query("UPDATE users SET money = ? WHERE id = ?", [buyerCashLeft, buyerId]);
    await conn.query("UPDATE users SET money = ? WHERE id = ?", [sellerCashLeft, sellerId]);
    await conn.commit();
    return { ok: true, buyerCashLeft, sellerCashLeft };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function payBusinessTax(
  ownerId: number,
  businessId: number,
  days: number
): Promise<PayBusinessTaxResult> {
  if (!Number.isInteger(days) || days < 1) {
    return { ok: false, reason: "db" };
  }

  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, price, tax_paid_until FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(bizRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const price = Math.max(0, Math.floor(Number(bizRow.price)));
    const amount = dailyBusinessTax(price) * days;
    const currentPaidUntil = parseTaxDate(bizRow.tax_paid_until);
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
    const [taxUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET tax_paid_until = ? WHERE id = ? AND owner_id = ?",
      [paidUntil, businessId, ownerId]
    );
    if (taxUpdate.affectedRows !== 1) {
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

export async function withdrawBusinessBalance(
  ownerId: number,
  businessId: number,
  amount: number
): Promise<WithdrawBusinessResult> {
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, reason: "db" };
  }

  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, balance FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (Number(bizRow.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    const balance = Math.max(0, Math.floor(Number(bizRow.balance)));
    if (balance < amount) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    const money = Math.max(0, Math.floor(Number(userRows[0]?.money ?? 0)));
    if (money > MAX_MONEY - amount) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const balanceLeft = balance - amount;
    const cashLeft = money + amount;

    const [bizUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET balance = ? WHERE id = ? AND owner_id = ?",
      [balanceLeft, businessId, ownerId]
    );
    if (bizUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "owner" };
    }

    await conn.query("UPDATE users SET money = ? WHERE id = ?", [cashLeft, ownerId]);
    await conn.commit();
    return { ok: true, cashLeft, balanceLeft, amount };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

export async function forfeitExpiredBusinesses(): Promise<number[]> {
  const conn = await getPool().getConnection();
  const forfeited: number[] = [];

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, owner_id
       FROM businesses
       WHERE owner_id IS NOT NULL
         AND (tax_paid_until IS NULL OR tax_paid_until < CURDATE())
       FOR UPDATE`
    );

    for (const row of rows) {
      const businessId = Number(row.id);
      const ownerId = Number(row.owner_id);
      if (!Number.isInteger(businessId) || !Number.isInteger(ownerId)) {
        continue;
      }

      const [bizUpdate] = await conn.query<ResultSetHeader>(
        `UPDATE businesses
         SET owner_id = NULL, tax_paid_until = NULL, balance = 0, is_locked = 0
         WHERE id = ? AND owner_id = ?`,
        [businessId, ownerId]
      );
      if (bizUpdate.affectedRows === 1) {
        forfeited.push(businessId);
      }
    }

    await conn.commit();
    return forfeited;
  } catch {
    await conn.rollback();
    throw new Error("не удалось изъять просроченные бизнесы");
  } finally {
    conn.release();
  }
}

export async function ensureBusinessesTable(): Promise<void> {
  await getPool().query(CREATE_BUSINESSES_SQL);
  await seedBusinesses();
  await migrateInteriorPickupCoords();
  cachedBusinesses = await loadBusinesses();
}

/** Точные interior/buy пикапы (обновляются при старте). */
async function migrateInteriorPickupCoords(): Promise<void> {
  const rows: Array<
    [number, number, number, number, number | null, number | null, number | null]
  > = [
    [1, -25.8889, -187.73, 1003.5469, -29.0572, -184.784, 1003.5469],
    [2, 6.1544, -31.2448, 1003.5494, 2.1883, -28.6322, 1003.5494],
    [3, -30.9334, -91.7799, 1003.5469, -28.0336, -89.8056, 1003.5469],
    [7, -25.8819, -187.718, 1003.5469, -28.9679, -184.8956, 1003.5469],
    [8, 6.1198, -31.1853, 1003.5494, 2.1919, -28.8258, 1003.5494],
    [9, -30.9235, -91.6223, 1003.5469, -28.086, -89.6605, 1003.5469],
    [10, 315.7881, -143.4585, 999.6016, 313.9817, -133.8136, 999.6016],
    [11, 285.3951, -41.2689, 1001.5156, 295.1631, -38.1616, 1001.5156],
    [12, 285.7627, -86.3651, 1001.5229, 295.5798, -80.5066, 1001.5156],
    [20, 372.354, -133.3325, 1001.4922, 375.649, -119.1394, 1001.4995],
    [21, 377.1435, -193.1428, 1000.6401, 379.2964, -190.4106, 1000.6328],
    [22, 363.2217, -74.9065, 1001.5078, 377.3967, -67.5993, 1001.5151],
    [23, 364.9169, -11.2147, 1001.8516, 369.5313, -6.3952, 1001.8589],
    [24, -229.16, 1401.2444, 27.7656, -224.9093, 1403.9136, 27.7734],
    [25, 372.3562, -133.3443, 1001.4922, 375.6143, -118.9356, 1001.4995],
    [26, 377.1115, -193.0494, 1000.6401, 379.2613, -190.4658, 1000.6328],
    [27, 772.3323, -5.1769, 1000.7287, null, null, null],
    [28, 773.8818, -78.3945, 1000.6621, null, null, null],
    [29, 204.3624, -168.6568, 1000.5234, null, null, null],
    [30, 207.6834, -110.9505, 1005.1328, null, null, null],
    [31, 207.0871, -139.9479, 1003.5078, null, null, null],
    [32, 501.9161, -67.9002, 998.7578, 497.0241, -75.7667, 998.7578],
    [33, 501.9901, -67.7595, 998.7578, 497.0165, -75.9557, 998.7578],
    [34, 501.955, -67.9791, 998.7578, 496.9535, -75.6969, 998.7578],
    [35, -2636.6331, 1402.8477, 906.4609, -2653.3042, 1407.2484, 906.2771],
    [51, 1133.1864, -15.4922, 1000.6797, 1139.5787, -4.1631, 1000.6719],
  ];

  const pool = getPool();
  for (const [id, ix, iy, iz, bx, by, bz] of rows) {
    await pool.query(
      `UPDATE businesses
       SET interior_x = ?, interior_y = ?, interior_z = ?,
           buy_pickup_x = ?, buy_pickup_y = ?, buy_pickup_z = ?,
           name = IF(id = 51 AND (name = 'Казино (Temple)' OR interior_id IS NULL),
                     'Casino (Redsands West) (Temple)', name),
           interior_id = IF(id = 51 AND interior_id IS NULL, 12, interior_id)
       WHERE id = ?`,
      [ix, iy, iz, bx, by, bz, id]
    );
  }
}

async function seedBusinesses(): Promise<void> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM businesses"
  );
  const count = Number(rows[0]?.cnt ?? 0);
  if (count > 0) {
    return;
  }

  await getPool().query(loadBusinessesSeedSql());
}

function loadBusinessesSeedSql(): string {
  const seedPath = join(process.cwd(), "sql", "businesses_seed.sql");
  if (!existsSync(seedPath)) {
    throw new Error("sql/businesses_seed.sql не найден");
  }

  const sql = readFileSync(seedPath, "utf8");
  const insertAt = sql.toUpperCase().indexOf("INSERT INTO BUSINESSES");
  if (insertAt < 0) {
    throw new Error("seed businesses повреждён");
  }

  return sql.slice(insertAt).trim();
}

export async function payBusinessEntranceFee(
  businessId: number,
  payerId: number,
  fee: number
): Promise<PayEntranceFeeResult> {
  if (fee <= 0) {
    const business = getBusiness(businessId);
    if (!business) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, cashLeft: -1, balance: business.balance };
  }

  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, balance FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [businessId]
    );
    const bizRow = bizRows[0];
    if (!bizRow) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [payerId]
    );
    const userRow = userRows[0];
    if (!userRow) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const money = Math.max(0, Math.floor(Number(userRow.money)));
    if (money < fee) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const cashLeft = money - fee;
    const balance = Math.min(
      MAX_MONEY,
      Math.max(0, Math.floor(Number(bizRow.balance))) + fee
    );

    const [userUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE users SET money = ? WHERE id = ? AND money >= ?",
      [cashLeft, payerId, fee]
    );
    if (userUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const [bizUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET balance = ? WHERE id = ?",
      [balance, businessId]
    );
    if (bizUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    await conn.commit();
    return { ok: true, cashLeft, balance };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

function parseTaxDate(value: Date | string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return null;
  }

  return text.slice(0, 10);
}

function optionalFloat(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

async function loadBusinesses(): Promise<BusinessRecord[]> {
  const rows = await query<BusinessRow>(
    `SELECT
      b.id,
      b.name,
      b.owner_id,
      u.name AS owner_name,
      b.type_id,
      b.entrance_x,
      b.entrance_y,
      b.entrance_z,
      b.interior_id,
      b.interior_x,
      b.interior_y,
      b.interior_z,
      b.buy_pickup_x,
      b.buy_pickup_y,
      b.buy_pickup_z,
      b.price,
      b.entrance_fee,
      b.balance,
      b.tax_paid_until,
      b.is_locked
    FROM businesses b
    LEFT JOIN users u ON u.id = b.owner_id
    ORDER BY b.id`
  );

  const businesses: BusinessRecord[] = [];

  for (const row of rows) {
    const id = Number(row.id);
    const ownerId = row.owner_id === null ? null : Number(row.owner_id);
    const ownerName =
      ownerId === null || row.owner_name === null || row.owner_name === ""
        ? null
        : String(row.owner_name);
    const typeId = Number(row.type_id);
    const entranceX = Number(row.entrance_x);
    const entranceY = Number(row.entrance_y);
    const entranceZ = Number(row.entrance_z);
    const price = Number(row.price);
    const entranceFee = Math.max(0, Math.floor(Number(row.entrance_fee)));
    const balance = Math.floor(Number(row.balance));
    const name = String(row.name ?? "").trim();

    if (
      !Number.isInteger(id) ||
      (ownerId !== null && !Number.isInteger(ownerId)) ||
      !Number.isInteger(typeId) ||
      !Number.isFinite(entranceX) ||
      !Number.isFinite(entranceY) ||
      !Number.isFinite(entranceZ) ||
      !Number.isInteger(price) ||
      name === ""
    ) {
      continue;
    }

    businesses.push({
      id,
      name,
      ownerId,
      ownerName,
      typeId,
      entranceX,
      entranceY,
      entranceZ,
      interiorId: optionalInt(row.interior_id),
      interiorX: optionalFloat(row.interior_x),
      interiorY: optionalFloat(row.interior_y),
      interiorZ: optionalFloat(row.interior_z),
      buyPickupX: optionalFloat(row.buy_pickup_x),
      buyPickupY: optionalFloat(row.buy_pickup_y),
      buyPickupZ: optionalFloat(row.buy_pickup_z),
      price,
      entranceFee,
      balance,
      taxPaidUntil: parseTaxDate(row.tax_paid_until),
      isLocked: Number(row.is_locked) !== 0,
    });
  }

  return businesses;
}
