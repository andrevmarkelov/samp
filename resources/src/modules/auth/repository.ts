import type { RowDataPacket } from "mysql2/promise";
import { execute, getPool, query } from "../../shared/database";
import { isGender, type Gender } from "./gender";
import {
  STARTING_HEALTH,
  normalizeHealth,
  type Account,
} from "./session";

export const STARTING_MONEY = 500;

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  gender: string;
  skin: number;
  level: number;
  money: number;
  donate: number;
  health: number;
  passport?: number | boolean;
  birth_date: Date | string;
};

const CREATE_USERS_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(24) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  gender ENUM('male', 'female') NOT NULL,
  skin SMALLINT UNSIGNED NOT NULL,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  money INT NOT NULL DEFAULT 0,
  donate INT UNSIGNED NOT NULL DEFAULT 0,
  health FLOAT NOT NULL DEFAULT 100,
  passport TINYINT(1) NOT NULL DEFAULT 0,
  birth_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_name (name),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const COLUMN_MIGRATIONS = [
  {
    name: "gender",
    sql: "gender ENUM('male', 'female') NOT NULL DEFAULT 'male' AFTER password_hash",
  },
  {
    name: "money",
    sql: "money INT NOT NULL DEFAULT 0 AFTER level",
  },
  {
    name: "donate",
    sql: "donate INT UNSIGNED NOT NULL DEFAULT 0 AFTER money",
  },
  {
    name: "health",
    sql: "health FLOAT NOT NULL DEFAULT 100 AFTER donate",
  },
  {
    name: "passport",
    sql: "passport TINYINT(1) NOT NULL DEFAULT 0 AFTER health",
  },
] as const;

export async function ensureUsersTable(): Promise<void> {
  await getPool().query(CREATE_USERS_SQL);

  for (const column of COLUMN_MIGRATIONS) {
    if (await columnExists(column.name)) {
      continue;
    }

    await getPool().query(`ALTER TABLE users ADD COLUMN ${column.sql}`);
  }
}

async function columnExists(column: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  );
  return rows.length > 0;
}

export async function findUserByName(name: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    "SELECT id, name, email, password_hash, gender, skin, level, money, donate, health, passport, birth_date FROM users WHERE name = ? LIMIT 1",
    [name]
  );
  return rows[0] ?? null;
}

export async function emailTaken(email: string): Promise<boolean> {
  const rows = await query<RowDataPacket>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows.length > 0;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  gender: Gender;
  skin: number;
  birthDate: string;
}): Promise<Account> {
  const result = await execute(
    "INSERT INTO users (name, email, password_hash, gender, skin, level, money, donate, health, passport, birth_date) VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, 0, ?)",
    [
      input.name,
      input.email,
      input.passwordHash,
      input.gender,
      input.skin,
      STARTING_MONEY,
      STARTING_HEALTH,
      input.birthDate,
    ]
  );

  return {
    id: Number(result.insertId),
    name: input.name,
    email: input.email,
    gender: input.gender,
    skin: input.skin,
    level: 1,
    money: STARTING_MONEY,
    donate: 0,
    health: STARTING_HEALTH,
    passport: false,
    birthDate: input.birthDate,
  };
}

export async function saveUserVitals(
  userId: number,
  health: number,
  money: number
): Promise<void> {
  await execute("UPDATE users SET health = ?, money = ? WHERE id = ?", [
    health,
    money,
    userId,
  ]);
}

export async function saveUserPassport(userId: number): Promise<void> {
  await execute("UPDATE users SET passport = 1 WHERE id = ?", [userId]);
}

export function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ER_DUP_ENTRY"
  );
}

export function accountFromRow(row: UserRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    gender: parseGender(row.gender),
    skin: Number(row.skin),
    level: Number(row.level),
    money: Number(row.money) || 0,
    donate: Number(row.donate) || 0,
    health: normalizeHealth(row.health),
    passport: Boolean(Number(row.passport)),
    birthDate: toIsoDate(row.birth_date),
  };
}

function parseGender(value: string): Gender {
  return isGender(value) ? value : "male";
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}
