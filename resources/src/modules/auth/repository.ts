import type { RowDataPacket } from "mysql2/promise";
import { execute, getPool, query } from "../../shared/database";
import { isGender, type Gender } from "./gender";
import {
  STARTING_HEALTH,
  normalizeHealth,
  type Account,
} from "./session";
import { parseOrgId, parseOrgRank } from "../org/membership";

export const STARTING_MONEY = 500;

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  gender: string;
  skin: number;
  level: number;
  exp: number;
  money: number;
  donate: number;
  health: number;
  passport: number | boolean;
  hospitalized: number | boolean;
  invited_by: string | null;
  birth_date: Date | string;
  admin_level: number;
  org_id: number;
  org_rank: number;
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
  exp INT UNSIGNED NOT NULL DEFAULT 0,
  money INT NOT NULL DEFAULT 0,
  donate INT UNSIGNED NOT NULL DEFAULT 0,
  health FLOAT NOT NULL DEFAULT 100,
  passport TINYINT(1) NOT NULL DEFAULT 0,
  hospitalized TINYINT(1) NOT NULL DEFAULT 0,
  invited_by VARCHAR(24) NULL DEFAULT NULL,
  register_ip VARCHAR(45) NULL DEFAULT NULL,
  last_ip VARCHAR(45) NULL DEFAULT NULL,
  admin_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  admin_password_hash VARCHAR(255) NULL DEFAULT NULL,
  org_id SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  org_rank TINYINT UNSIGNED NOT NULL DEFAULT 0,
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
    name: "exp",
    sql: "exp INT UNSIGNED NOT NULL DEFAULT 0 AFTER level",
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
  {
    name: "hospitalized",
    sql: "hospitalized TINYINT(1) NOT NULL DEFAULT 0 AFTER passport",
  },
  {
    name: "invited_by",
    sql: "invited_by VARCHAR(24) NULL DEFAULT NULL AFTER hospitalized",
  },
  {
    name: "register_ip",
    sql: "register_ip VARCHAR(45) NULL DEFAULT NULL AFTER invited_by",
  },
  {
    name: "last_ip",
    sql: "last_ip VARCHAR(45) NULL DEFAULT NULL AFTER register_ip",
  },
  {
    name: "admin_level",
    sql: "admin_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER last_ip",
  },
  {
    name: "admin_password_hash",
    sql: "admin_password_hash VARCHAR(255) NULL DEFAULT NULL AFTER admin_level",
  },
  {
    name: "org_id",
    sql: "org_id SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_password_hash",
  },
  {
    name: "org_rank",
    sql: "org_rank TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER org_id",
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
    "SELECT id, name, email, password_hash, gender, skin, level, exp, money, donate, health, passport, hospitalized, invited_by, birth_date, admin_level, org_id, org_rank FROM users WHERE name = ? LIMIT 1",
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
  ip: string;
}): Promise<Account> {
  const ip = input.ip || null;
  const result = await execute(
    "INSERT INTO users (name, email, password_hash, gender, skin, level, money, donate, health, passport, hospitalized, birth_date, register_ip, last_ip) VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, 0, 0, ?, ?, ?)",
    [
      input.name,
      input.email,
      input.passwordHash,
      input.gender,
      input.skin,
      STARTING_MONEY,
      STARTING_HEALTH,
      input.birthDate,
      ip,
      ip,
    ]
  );

  return {
    id: Number(result.insertId),
    name: input.name,
    email: input.email,
    gender: input.gender,
    skin: input.skin,
    level: 1,
    exp: 0,
    money: STARTING_MONEY,
    donate: 0,
    health: STARTING_HEALTH,
    passport: false,
    hospitalized: false,
    invitedBy: null,
    birthDate: input.birthDate,
    adminLevel: 0,
    orgId: 0,
    orgRank: 0,
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

export async function saveUserHospitalized(
  userId: number,
  hospitalized: boolean,
  health: number
): Promise<void> {
  await execute("UPDATE users SET hospitalized = ?, health = ? WHERE id = ?", [
    hospitalized ? 1 : 0,
    health,
    userId,
  ]);
}

export async function saveUserInvitedBy(
  userId: number,
  invitedBy: string
): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET invited_by = ? WHERE id = ? AND invited_by IS NULL",
    [invitedBy, userId]
  );
  return Number(result.affectedRows) > 0;
}

export async function saveUserLastIp(userId: number, ip: string): Promise<void> {
  if (!ip) {
    return;
  }

  await execute("UPDATE users SET last_ip = ? WHERE id = ?", [ip, userId]);
}

export async function saveUserProgress(
  userId: number,
  level: number,
  exp: number
): Promise<void> {
  await execute("UPDATE users SET level = ?, exp = ? WHERE id = ?", [
    level,
    exp,
    userId,
  ]);
}

export async function findAdminCredentials(userId: number): Promise<{
  adminLevel: number;
  passwordHash: string | null;
} | null> {
  const rows = await query<
    RowDataPacket & { admin_level: number; admin_password_hash: string | null }
  >(
    "SELECT admin_level, admin_password_hash FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  const raw = String(row.admin_password_hash ?? "").trim();
  return {
    adminLevel: parseAdminLevel(row.admin_level),
    passwordHash: raw.length > 0 ? raw : null,
  };
}

export async function saveAdminAccess(
  userId: number,
  adminLevel: number
): Promise<void> {
  await execute(
    "UPDATE users SET admin_level = ?, admin_password_hash = NULL WHERE id = ?",
    [adminLevel, userId]
  );
}

export async function saveAdminPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  await execute("UPDATE users SET admin_password_hash = ? WHERE id = ?", [
    passwordHash,
    userId,
  ]);
}

export async function saveUserOrg(
  userId: number,
  orgId: number,
  orgRank: number
): Promise<void> {
  await execute("UPDATE users SET org_id = ?, org_rank = ? WHERE id = ?", [
    orgId,
    orgRank,
    userId,
  ]);
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
    level: Number(row.level) || 1,
    exp: Number(row.exp) || 0,
    money: Number(row.money) || 0,
    donate: Number(row.donate) || 0,
    health: normalizeHealth(row.health),
    passport: Boolean(Number(row.passport)),
    hospitalized: Boolean(Number(row.hospitalized)),
    invitedBy: parseInvitedBy(row.invited_by),
    birthDate: toIsoDate(row.birth_date),
    adminLevel: parseAdminLevel(row.admin_level),
    orgId: parseOrgId(row.org_id),
    orgRank: parseOrgRank(row.org_rank),
  };
}

function parseAdminLevel(value: unknown): number {
  const level = Math.floor(Number(value) || 0);
  if (level < 0) {
    return 0;
  }
  if (level > 7) {
    return 7;
  }
  return level;
}

function parseInvitedBy(value: string | null | undefined): string | null {
  const name = String(value ?? "").trim();
  return name.length > 0 ? name : null;
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
