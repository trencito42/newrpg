import mysql, { Pool, ResultSetHeader } from "mysql2/promise";

let pool: Pool | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required database configuration: ${name}`);
  return value;
}

export function getDbPool(): Pool {
  if (!pool) {
    const port = Number(requiredEnv("DB_PORT"));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Invalid database configuration: DB_PORT");
    }
    pool = mysql.createPool({
      host: requiredEnv("DB_HOST"),
      port,
      user: requiredEnv("DB_USER"),
      password: requiredEnv("DB_PASSWORD"),
      database: requiredEnv("DB_NAME"),
      waitForConnections: true,
      connectionLimit: 20,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
      charset: "utf8mb4",
    });
  }
  return pool;
}

/** Execute a parameterized SELECT query returning an array of typed rows. */
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = getDbPool();
  const [rows] = await p.query<any[]>(sql, params);
  return rows as T[];
}

/** Execute a parameterized SELECT query returning a single row or null. */
export async function dbQuerySingle<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Execute a parameterized INSERT/UPDATE/DELETE query. */
export async function dbExecute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const p = getDbPool();
  const [result] = await p.execute<ResultSetHeader>(sql, params);
  return result;
}

/** Run a block of queries inside an atomic transaction. */
export async function dbTransaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const p = getDbPool();
  const connection = await p.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export const query = dbQuery;
export const queryOne = dbQuerySingle;
export const execute = dbExecute;
