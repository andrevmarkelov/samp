import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;

function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export async function connectDatabase(): Promise<void> {
  loadEnvFile();

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "lsrp",
    charset: "utf8mb4",
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
  });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    const open = pool;
    pool = null;
    await open.end().catch(() => undefined);
    throw error;
  }
}

export function isDatabaseReady(): boolean {
  return pool !== null;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("База данных ещё не подключена");
  }

  return pool;
}

export async function query<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await getPool().query(sql, params);
  return result as ResultSetHeader;
}

export async function closeDatabase(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
