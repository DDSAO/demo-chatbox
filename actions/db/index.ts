"use server";

import { db } from "@/db";
import { chat as chatTable, session as sessionTable } from "@/db/schema";
import { ChatHistory, ChatRole } from "@/lib/ai";
import { and, asc, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";

export type CreateSessionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Inserts a session row; `id` and `created_at` use database defaults. */
export async function createSession(): Promise<CreateSessionResult> {
  try {
    const [inserted] = await db
      .insert(sessionTable)
      .values({})
      .returning({ id: sessionTable.id });
    if (inserted === undefined) {
      return { ok: false, error: "Insert returned no row" };
    }
    return { ok: true, id: inserted.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create session";
    return { ok: false, error: message };
  }
}

export type SaveChatResult =
  | { ok: true; id: number; sessionId: string }
  | { ok: false; error: string };

const UUID_V4_RE =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/** Latest `limit` rows for a session, oldest-first (chronological). `content` is truncated in the DB. */
export async function fetchRecentChatBySessionId(
  sessionId: string,
  limit = 10,
): Promise<{ role: string; content: string }[]> {
  const rows = await db
    .select({
      role: chatTable.role,
      content: sql<string>`demo.truncate_words_head_tail(${chatTable.content}, 300, 300)`,
    })
    .from(chatTable)
    .where(and(eq(chatTable.sessionId, sessionId), isNull(chatTable.deletedAt)))
    .orderBy(desc(chatTable.createdAt))
    .limit(limit);

  return rows.reverse();
}

/** Most recently created session’s messages, oldest-first. Empty array if no session exists. */
export async function loadLatestHistory(): Promise<ChatHistory[]> {
  const [latest] = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .orderBy(desc(sessionTable.createdAt))
    .limit(1);

  if (latest === undefined) {
    return [];
  }

  return db
    .select({
      id: chatTable.id,
      sessionId: chatTable.sessionId,
      role: chatTable.role,
      content: chatTable.content,
    })
    .from(chatTable)
    .where(and(eq(chatTable.sessionId, latest.id), isNull(chatTable.deletedAt)))
    .orderBy(asc(chatTable.createdAt));
}

/** Inserts one chat row. */
export async function saveChat(input: {
  sessionId: string;
  text: string;
  role: ChatRole;
}): Promise<SaveChatResult> {
  const content = input.text.trim();
  if (content === "") {
    return { ok: false, error: "Text is empty" };
  }

  const sessionId = input.sessionId.trim();
  if (sessionId === "") {
    return { ok: false, error: "Session id is required" };
  }
  if (!UUID_V4_RE.test(sessionId)) {
    return { ok: false, error: "Invalid session id" };
  }

  if (input.role !== ChatRole.User && input.role !== ChatRole.Assistant) {
    return { ok: false, error: "Invalid role" };
  }

  try {
    const [inserted] = await db
      .insert(chatTable)
      .values({ sessionId, role: input.role, content })
      .returning({ id: chatTable.id });
    if (inserted === undefined) {
      return { ok: false, error: "Insert returned no row" };
    }
    return { ok: true, id: inserted.id, sessionId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save chat";
    return { ok: false, error: message };
  }
}

export type SoftDeleteChatsAfterResult =
  | { ok: true; chatId: number; softDeletedCount: number }
  | { ok: false; error: string };

const nowEpochSeconds = sql<number>`(extract(epoch from now()))::integer`;

/**
 * Sets `content` on the chat row at `chatId` (must belong to `sessionId`), then soft-deletes every
 * later row in that session (`id` greater than `chatId`). Ordering matches insert order (serial id).
 */
export async function softDeleteChatsAfter(input: {
  sessionId: string;
  chatId: number;
  updatedContent: string;
}): Promise<SoftDeleteChatsAfterResult> {
  const content = input.updatedContent.trim();
  if (content === "") {
    return { ok: false, error: "Updated content is empty" };
  }

  const sessionId = input.sessionId.trim();
  if (sessionId === "") {
    return { ok: false, error: "Session id is required" };
  }
  if (!UUID_V4_RE.test(sessionId)) {
    return { ok: false, error: "Invalid session id" };
  }

  const chatId = input.chatId;
  if (!Number.isInteger(chatId) || chatId < 1) {
    return { ok: false, error: "Invalid chat id" };
  }

  type TxResult =
    | { error: string }
    | { ok: true; chatId: number; softDeletedCount: number };

  try {
    const result = await db.transaction(async (tx): Promise<TxResult> => {
      const [updated] = await tx
        .update(chatTable)
        .set({ content })
        .where(
          and(eq(chatTable.id, chatId), eq(chatTable.sessionId, sessionId)),
        )
        .returning({ id: chatTable.id });

      if (updated === undefined) {
        return { error: "Chat not found for this session" as const };
      }

      const softDeleted = await tx
        .update(chatTable)
        .set({ deletedAt: nowEpochSeconds })
        .where(
          and(
            eq(chatTable.sessionId, sessionId),
            gt(chatTable.id, chatId),
            isNull(chatTable.deletedAt),
          ),
        )
        .returning({ id: chatTable.id });

      return {
        ok: true as const,
        chatId: updated.id,
        softDeletedCount: softDeleted.length,
      };
    });

    if ("error" in result) {
      return { ok: false, error: result.error };
    }
    return result;
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update chat and soft-delete";
    return { ok: false, error: message };
  }
}

export type SoftDeleteChatsFromResult =
  | { ok: true; softDeletedCount: number }
  | { ok: false; error: string };

/**
 * Soft-deletes the chat row at `chatId` and every later row in that session (`id` >= `chatId`).
 */
export async function softDeleteChatsFrom(input: {
  sessionId: string;
  chatId: number;
}): Promise<SoftDeleteChatsFromResult> {
  const sessionId = input.sessionId.trim();
  if (sessionId === "") {
    return { ok: false, error: "Session id is required" };
  }
  if (!UUID_V4_RE.test(sessionId)) {
    return { ok: false, error: "Invalid session id" };
  }

  const chatId = input.chatId;
  if (!Number.isInteger(chatId) || chatId < 1) {
    return { ok: false, error: "Invalid chat id" };
  }

  try {
    const softDeleted = await db
      .update(chatTable)
      .set({ deletedAt: nowEpochSeconds })
      .where(
        and(
          eq(chatTable.sessionId, sessionId),
          gte(chatTable.id, chatId),
          isNull(chatTable.deletedAt),
        ),
      )
      .returning({ id: chatTable.id });

    if (softDeleted.length === 0) {
      return {
        ok: false,
        error: "No active messages found to delete for this session",
      };
    }

    return { ok: true, softDeletedCount: softDeleted.length };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to soft-delete messages";
    return { ok: false, error: message };
  }
}
