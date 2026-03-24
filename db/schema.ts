import { ChatRole } from "@/lib/ai";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgSchema,
  serial,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const demo = pgSchema("demo");

export const session = demo.table(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Instant in time as Unix epoch **seconds** (UTC). Same moment for every reader—no embedded
     * timezone or “local date” interpretation. Apply a timezone only when formatting for display.
     */
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(extract(epoch from now()))::integer`),
  },
  (t) => [index("session_created_at_idx").on(t.createdAt)],
);

export const chat = demo.table(
  "chat",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id),
    role: varchar("role", {
      length: 32,
      enum: [ChatRole.User, ChatRole.Assistant],
    }).notNull(),
    content: text("content").notNull(),
    /**
     * Instant in time as Unix epoch **seconds** (UTC). Same moment for every reader—no embedded
     * timezone or “local date” interpretation. Apply a timezone only when formatting for display.
     * Postgres `extract(epoch from now())` measures from 1970-01-01 00:00:00 **UTC**, not wall-clock bias.
     */
    createdAt: integer("created_at")
      .notNull()
      // Server default: current instant, stored as UTC-based epoch seconds (not local time).
      .default(sql`(extract(epoch from now()))::integer`),
    /**
     * Soft-delete instant as Unix epoch **seconds** (UTC). `null` means the row is active.
     */
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("chat_session_id_idx").on(t.sessionId),
    index("chat_created_at_idx").on(t.createdAt),
  ],
);
