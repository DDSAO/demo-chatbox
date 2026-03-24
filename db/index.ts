import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name} for database connection`);
  }
  return v.replace(/^["']|["']$/g, "");
}

function createPool(): Pool {
  return new Pool({
    host: requireEnv("PG_HOST"),
    port: Number(process.env.PG_PORT) || 5432,
    user: requireEnv("PG_USERNAME"),
    password: requireEnv("PG_PASSWORD"),
    database: requireEnv("PG_DATABASE"),
    ssl:
      process.env.PG_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

type GlobalDrizzle = typeof globalThis & {
  __drizzlePool?: Pool;
  __drizzleDb?: NodePgDatabase<typeof schema>;
};

const g = globalThis as GlobalDrizzle;

const pool = g.__drizzlePool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  g.__drizzlePool = pool;
}

export const db = g.__drizzleDb ?? drizzle(pool, { schema });
if (process.env.NODE_ENV !== "production") {
  g.__drizzleDb = db;
}

export type Db = typeof db;
