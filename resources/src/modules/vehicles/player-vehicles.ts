import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../shared/database";

/** Личный транспорт игрока (не путать с runtime vehicle id в мире). */
const CREATE_PLAYER_VEHICLES_SQL = `
CREATE TABLE IF NOT EXISTS player_vehicles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  model_id SMALLINT UNSIGNED NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  color1 TINYINT UNSIGNED NOT NULL DEFAULT 0,
  color2 TINYINT UNSIGNED NOT NULL DEFAULT 0,
  fuel TINYINT UNSIGNED NOT NULL DEFAULT 100,
  health FLOAT NOT NULL DEFAULT 1000,
  is_locked TINYINT(1) NOT NULL DEFAULT 1,
  has_nitro TINYINT(1) NOT NULL DEFAULT 0,
  trunk_metal INT UNSIGNED NOT NULL DEFAULT 0,
  trunk_ammo INT UNSIGNED NOT NULL DEFAULT 0,
  trunk_drugs INT UNSIGNED NOT NULL DEFAULT 0,
  purchase_price INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_player_vehicles_owner_id (owner_id),
  KEY idx_player_vehicles_model_id (model_id),
  CONSTRAINT fk_player_vehicles_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const COLUMN_MIGRATIONS: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: "purchase_price",
    sql: "purchase_price INT UNSIGNED NOT NULL DEFAULT 0 AFTER trunk_drugs",
  },
];

export const DEFAULT_VEHICLE_FUEL = 100;
export const DEFAULT_VEHICLE_HEALTH = 1000;
export const DEFAULT_BUY_COLOR = 1;
export const MAX_TRUNK_METAL = 500;
export const MAX_TRUNK_AMMO = 500;
export const MAX_TRUNK_DRUGS = 500;
/** Доля от purchase_price при продаже государству. */
export const STATE_SELL_REFUND_RATE = 0.5;
const MAX_MONEY = 2_147_483_647;

export type PlayerVehicleRecord = {
  id: number;
  modelId: number;
  ownerId: number;
  color1: number;
  color2: number;
  fuel: number;
  health: number;
  isLocked: boolean;
  hasNitro: boolean;
  trunkMetal: number;
  trunkAmmo: number;
  trunkDrugs: number;
  purchasePrice: number;
  createdAt: string;
};

export type PurchasePlayerVehicleResult =
  | {
      ok: true;
      vehicle: PlayerVehicleRecord;
      cashLeft: number;
      balance: number;
      businessGain: number;
      amount: number;
    }
  | { ok: false; reason: "owned" | "funds" | "not_found" | "db" };

type PlayerVehicleRow = RowDataPacket & {
  id: number;
  model_id: number;
  owner_id: number;
  color1: number;
  color2: number;
  fuel: number;
  health: number;
  is_locked: number;
  has_nitro: number;
  trunk_metal: number;
  trunk_ammo: number;
  trunk_drugs: number;
  purchase_price: number;
  created_at: Date | string;
};

const VEHICLE_SELECT = `id, model_id, owner_id, color1, color2, fuel, health,
            is_locked, has_nitro, trunk_metal, trunk_ammo, trunk_drugs, purchase_price, created_at`;

export async function ensurePlayerVehiclesTable(): Promise<void> {
  await getPool().query(CREATE_PLAYER_VEHICLES_SQL);

  for (const column of COLUMN_MIGRATIONS) {
    if (await columnExists(column.name)) {
      continue;
    }
    await getPool().query(`ALTER TABLE player_vehicles ADD COLUMN ${column.sql}`);
  }
}

/** Сумма возврата при продаже государству. */
export function stateSellRefund(purchasePrice: number): number {
  const price = Math.max(0, Math.floor(purchasePrice));
  return Math.max(0, Math.floor(price * STATE_SELL_REFUND_RATE));
}

export async function countPlayerVehicles(ownerId: number): Promise<number> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM player_vehicles WHERE owner_id = ?",
    [ownerId]
  );
  return Math.max(0, Math.floor(Number(rows[0]?.cnt ?? 0)));
}

export async function findOwnedPlayerVehicle(
  ownerId: number
): Promise<PlayerVehicleRecord | null> {
  const [rows] = await getPool().query<PlayerVehicleRow[]>(
    `SELECT ${VEHICLE_SELECT}
     FROM player_vehicles
     WHERE owner_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [ownerId]
  );
  const row = rows[0];
  return row ? mapPlayerVehicleRow(row) : null;
}

export async function listPlayerVehicles(ownerId: number): Promise<PlayerVehicleRecord[]> {
  const [rows] = await getPool().query<PlayerVehicleRow[]>(
    `SELECT ${VEHICLE_SELECT}
     FROM player_vehicles
     WHERE owner_id = ?
     ORDER BY id ASC`,
    [ownerId]
  );

  return rows.map(mapPlayerVehicleRow);
}

export async function getPlayerVehicle(vehicleId: number): Promise<PlayerVehicleRecord | null> {
  const [rows] = await getPool().query<PlayerVehicleRow[]>(
    `SELECT ${VEHICLE_SELECT}
     FROM player_vehicles
     WHERE id = ?
     LIMIT 1`,
    [vehicleId]
  );

  const row = rows[0];
  return row ? mapPlayerVehicleRow(row) : null;
}

export async function updatePlayerVehicleLock(
  vehicleId: number,
  locked: boolean
): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    "UPDATE player_vehicles SET is_locked = ? WHERE id = ?",
    [locked ? 1 : 0, vehicleId]
  );
  return result.affectedRows === 1;
}

export async function updatePlayerVehicleHealth(
  vehicleId: number,
  health: number
): Promise<boolean> {
  const hp = Math.max(250, Math.min(1000, Math.round(health)));
  const [result] = await getPool().query<ResultSetHeader>(
    "UPDATE player_vehicles SET health = ? WHERE id = ?",
    [hp, vehicleId]
  );
  return result.affectedRows === 1;
}

export async function updatePlayerVehicleFuel(
  vehicleId: number,
  fuel: number
): Promise<boolean> {
  const value = Math.max(0, Math.min(DEFAULT_VEHICLE_FUEL, Math.round(fuel)));
  const [result] = await getPool().query<ResultSetHeader>(
    "UPDATE player_vehicles SET fuel = ? WHERE id = ?",
    [value, vehicleId]
  );
  return result.affectedRows === 1;
}

export type TrunkItem = "ammo" | "metal" | "drugs";

function trunkColumn(item: TrunkItem): string {
  if (item === "ammo") {
    return "trunk_ammo";
  }
  if (item === "metal") {
    return "trunk_metal";
  }
  return "trunk_drugs";
}

function trunkCap(item: TrunkItem): number {
  if (item === "ammo") {
    return MAX_TRUNK_AMMO;
  }
  if (item === "metal") {
    return MAX_TRUNK_METAL;
  }
  return MAX_TRUNK_DRUGS;
}

/** Удалить личный транспорт владельца (без возврата денег). */
export async function deletePlayerVehicle(
  vehicleId: number,
  ownerId: number
): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    "DELETE FROM player_vehicles WHERE id = ? AND owner_id = ?",
    [vehicleId, ownerId]
  );
  return result.affectedRows === 1;
}

/**
 * Продажа государству: удаление ТС + возврат STATE_SELL_REFUND_RATE от purchase_price.
 */
export async function sellPlayerVehicleToState(
  vehicleId: number,
  ownerId: number
): Promise<
  | { ok: true; cashLeft: number; refund: number; purchasePrice: number }
  | { ok: false; reason: "vehicle" | "db" }
> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [vehRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id, purchase_price FROM player_vehicles WHERE id = ? LIMIT 1 FOR UPDATE",
      [vehicleId]
    );
    const veh = vehRows[0];
    if (!veh || Number(veh.owner_id) !== ownerId) {
      await conn.rollback();
      return { ok: false, reason: "vehicle" };
    }

    const purchasePrice = Math.max(0, Math.floor(Number(veh.purchase_price)));
    const refund = stateSellRefund(purchasePrice);

    const [del] = await conn.query<ResultSetHeader>(
      "DELETE FROM player_vehicles WHERE id = ? AND owner_id = ?",
      [vehicleId, ownerId]
    );
    if (del.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "vehicle" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    if (!userRows[0]) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const money = Math.max(0, Math.floor(Number(userRows[0].money)));
    const cashLeft = Math.min(MAX_MONEY, money + refund);

    const [userUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE users SET money = ? WHERE id = ?",
      [cashLeft, ownerId]
    );
    if (userUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    await conn.commit();
    return { ok: true, cashLeft, refund, purchasePrice };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

/**
 * Продажа игроку: смена владельца + перевод наличных.
 * Багажник и остальные поля остаются.
 */
export async function transferPlayerVehicleSale(params: {
  vehicleId: number;
  sellerId: number;
  buyerId: number;
  price: number;
}): Promise<
  | { ok: true; sellerCash: number; buyerCash: number }
  | { ok: false; reason: "vehicle" | "owned" | "funds" | "db" }
> {
  const price = Math.floor(params.price);
  if (!Number.isInteger(price) || price < 1) {
    return { ok: false, reason: "db" };
  }

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [vehRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, owner_id FROM player_vehicles WHERE id = ? LIMIT 1 FOR UPDATE",
      [params.vehicleId]
    );
    const veh = vehRows[0];
    if (!veh || Number(veh.owner_id) !== params.sellerId) {
      await conn.rollback();
      return { ok: false, reason: "vehicle" };
    }

    const [buyerOwned] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM player_vehicles WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [params.buyerId]
    );
    if (buyerOwned.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "owned" };
    }

    const [sellerRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [params.sellerId]
    );
    const [buyerRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [params.buyerId]
    );
    if (!sellerRows[0] || !buyerRows[0]) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const sellerMoney = Math.max(0, Math.floor(Number(sellerRows[0].money)));
    const buyerMoney = Math.max(0, Math.floor(Number(buyerRows[0].money)));
    if (buyerMoney < price) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const buyerCash = buyerMoney - price;
    const sellerCash = Math.min(MAX_MONEY, sellerMoney + price);

    const [vehUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE player_vehicles SET owner_id = ? WHERE id = ? AND owner_id = ?",
      [params.buyerId, params.vehicleId, params.sellerId]
    );
    if (vehUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "vehicle" };
    }

    const [buyerUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE users SET money = ? WHERE id = ? AND money >= ?",
      [buyerCash, params.buyerId, price]
    );
    if (buyerUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const [sellerUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE users SET money = ? WHERE id = ?",
      [sellerCash, params.sellerId]
    );
    if (sellerUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    await conn.commit();
    return { ok: true, sellerCash, buyerCash };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

/** Положить в багажник. false — нет места / машина не найдена. */
export async function addPlayerVehicleTrunk(
  vehicleId: number,
  item: TrunkItem,
  amount: number
): Promise<boolean> {
  const qty = Math.floor(amount);
  if (!Number.isInteger(qty) || qty < 1) {
    return false;
  }

  const column = trunkColumn(item);
  const cap = trunkCap(item);
  const [result] = await getPool().query<ResultSetHeader>(
    `UPDATE player_vehicles
     SET ${column} = ${column} + ?
     WHERE id = ? AND ${column} + ? <= ?`,
    [qty, vehicleId, qty, cap]
  );
  return result.affectedRows === 1;
}

/** Взять из багажника. false — недостаточно / машина не найдена. */
export async function takePlayerVehicleTrunk(
  vehicleId: number,
  item: TrunkItem,
  amount: number
): Promise<boolean> {
  const qty = Math.floor(amount);
  if (!Number.isInteger(qty) || qty < 1) {
    return false;
  }

  const column = trunkColumn(item);
  const [result] = await getPool().query<ResultSetHeader>(
    `UPDATE player_vehicles
     SET ${column} = ${column} - ?
     WHERE id = ? AND ${column} >= ?`,
    [qty, vehicleId, qty]
  );
  return result.affectedRows === 1;
}

/** Покупка: списание наличных, 80% на balance бизнеса, INSERT в player_vehicles. */
export async function purchasePlayerVehicle(params: {
  ownerId: number;
  businessId: number;
  modelId: number;
  price: number;
  color1?: number;
  color2?: number;
}): Promise<PurchasePlayerVehicleResult> {
  const price = Math.floor(params.price);
  if (!Number.isInteger(price) || price < 1) {
    return { ok: false, reason: "db" };
  }
  if (!Number.isInteger(params.modelId) || params.modelId < 400 || params.modelId > 611) {
    return { ok: false, reason: "db" };
  }

  const color1 = params.color1 ?? DEFAULT_BUY_COLOR;
  const color2 = params.color2 ?? DEFAULT_BUY_COLOR;
  const businessGain = Math.floor(price * 0.8);
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const [ownedRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM player_vehicles WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [params.ownerId]
    );
    if (ownedRows.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "owned" };
    }

    const [bizRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, balance FROM businesses WHERE id = ? LIMIT 1 FOR UPDATE",
      [params.businessId]
    );
    if (!bizRows[0]) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }

    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT money FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [params.ownerId]
    );
    const userRow = userRows[0];
    if (!userRow) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const money = Math.max(0, Math.floor(Number(userRow.money)));
    if (money < price) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const cashLeft = money - price;
    const balance = Math.min(
      MAX_MONEY,
      Math.max(0, Math.floor(Number(bizRows[0].balance))) + businessGain
    );

    const [userUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE users SET money = ? WHERE id = ? AND money >= ?",
      [cashLeft, params.ownerId, price]
    );
    if (userUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "funds" };
    }

    const [bizUpdate] = await conn.query<ResultSetHeader>(
      "UPDATE businesses SET balance = ? WHERE id = ?",
      [balance, params.businessId]
    );
    if (bizUpdate.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    const [insertResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO player_vehicles
         (model_id, owner_id, color1, color2, fuel, health, is_locked, has_nitro, purchase_price)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [
        params.modelId,
        params.ownerId,
        color1,
        color2,
        DEFAULT_VEHICLE_FUEL,
        DEFAULT_VEHICLE_HEALTH,
        price,
      ]
    );

    const vehicleId = Number(insertResult.insertId);
    if (!Number.isInteger(vehicleId) || vehicleId < 1) {
      await conn.rollback();
      return { ok: false, reason: "db" };
    }

    await conn.commit();

    return {
      ok: true,
      cashLeft,
      balance,
      businessGain,
      amount: price,
      vehicle: {
        id: vehicleId,
        modelId: params.modelId,
        ownerId: params.ownerId,
        color1,
        color2,
        fuel: DEFAULT_VEHICLE_FUEL,
        health: DEFAULT_VEHICLE_HEALTH,
        isLocked: true,
        hasNitro: false,
        trunkMetal: 0,
        trunkAmmo: 0,
        trunkDrugs: 0,
        purchasePrice: price,
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      },
    };
  } catch {
    await conn.rollback();
    return { ok: false, reason: "db" };
  } finally {
    conn.release();
  }
}

function mapPlayerVehicleRow(row: PlayerVehicleRow): PlayerVehicleRecord {
  return {
    id: Number(row.id),
    modelId: Number(row.model_id),
    ownerId: Number(row.owner_id),
    color1: Number(row.color1),
    color2: Number(row.color2),
    fuel: Number(row.fuel),
    health: Number(row.health),
    isLocked: Number(row.is_locked) !== 0,
    hasNitro: Number(row.has_nitro) !== 0,
    trunkMetal: Number(row.trunk_metal),
    trunkAmmo: Number(row.trunk_ammo),
    trunkDrugs: Number(row.trunk_drugs),
    purchasePrice: Math.max(0, Math.floor(Number(row.purchase_price ?? 0))),
    createdAt: formatDateTime(row.created_at),
  };
}

async function columnExists(columnName: string): Promise<boolean> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'player_vehicles'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );
  return rows.length > 0;
}

function formatDateTime(value: Date | string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  return String(value).slice(0, 19);
}
