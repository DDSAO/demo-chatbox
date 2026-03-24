import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.development" });

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name} for Drizzle (check .env.development)`);
  }
  return v.replace(/^["']|["']$/g, "");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: env("PG_HOST"),
    port: Number(process.env.PG_PORT) || 5432,
    user: env("PG_USERNAME"),
    password: env("PG_PASSWORD"),
    database: env("PG_DATABASE"),
    ssl:
      process.env.PG_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  },
});
