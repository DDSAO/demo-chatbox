"use server";

import {
  createSession,
  fetchRecentChatBySessionId,
  saveChat,
  softDeleteChatsAfter,
  softDeleteChatsFrom,
} from "@/actions/db";
import { ChatRole, type Model } from "@/lib/ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const UUID_V4_RE =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

type RecentRow = { role: string; content: string };

async function streamGeminiChatReply(options: {
  apiKey: string;
  model: Model;
  resolvedSessionId: string;
  userChatId: number;
  message: string;
  recentRows: RecentRow[];
}): Promise<ReadableStream<Uint8Array>> {
  const {
    apiKey,
    model,
    resolvedSessionId,
    userChatId,
    message,
    recentRows,
  } = options;

  const history = recentRows
    .map((row) => ({
      role:
        row.role === ChatRole.Assistant
          ? ("model" as const)
          : ("user" as const),
      parts: [{ text: row.content }],
    }))
    .filter((h) => h.parts[0].text.length > 0);

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const session = geminiModel.startChat({ history });
  const { stream } = await session.sendMessageStream(message);

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let assistantFull = "";
      controller.enqueue(
        encoder.encode(
          `--start-session-id--\n${resolvedSessionId}\n--end-session-id--\n--start-user-chat-id--\n${userChatId}\n--end-user-chat-id--\n--start-response--\n`,
        ),
      );
      try {
        for await (const chunk of stream) {
          let piece: string;
          try {
            piece = chunk.text();
          } catch {
            continue;
          }
          if (piece) {
            assistantFull += piece;
            controller.enqueue(encoder.encode(piece));
          }
        }
        controller.enqueue(encoder.encode(`--end-response--\n`));
        const assistantText = assistantFull.trim();
        if (assistantText !== "") {
          const assistantSaved = await saveChat({
            sessionId: resolvedSessionId,
            text: assistantText,
            role: ChatRole.Assistant,
          });
          if (!assistantSaved.ok) {
            throw new Error(assistantSaved.error);
          }
          controller.enqueue(
            encoder.encode(
              `--start-chat-id--\n${assistantSaved.id}\n--end-chat-id--\n`,
            ),
          );
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

export async function chat(
  model: Model,
  text: string,
  sessionId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const message = text.trim();
  if (message === "") {
    throw new Error("Message is empty");
  }

  const trimmedSessionId = sessionId?.trim() ?? "";
  let resolvedSessionId: string;
  let isNewSession = false;
  if (trimmedSessionId === "") {
    const created = await createSession();
    if (!created.ok) {
      throw new Error(created.error);
    }
    resolvedSessionId = created.id;
    isNewSession = true;
  } else if (!UUID_V4_RE.test(trimmedSessionId)) {
    throw new Error("Invalid session id");
  } else {
    resolvedSessionId = trimmedSessionId;
  }

  const userSaved = await saveChat({
    sessionId: resolvedSessionId,
    text: message,
    role: ChatRole.User,
  });
  if (!userSaved.ok) {
    throw new Error(userSaved.error);
  }

  const recentRows = isNewSession
    ? []
    : await fetchRecentChatBySessionId(resolvedSessionId, 10);

  return streamGeminiChatReply({
    apiKey,
    model,
    resolvedSessionId,
    userChatId: userSaved.id,
    message,
    recentRows,
  });
}

/**
 * Persists the edited user message and drops later turns via {@link softDeleteChatsAfter}, then
 * streams a fresh assistant reply using the same framing as {@link chat}.
 */
export async function updateChat(input: {
  sessionId: string;
  chatId: number;
  model: Model;
  updatedContent: string;
}): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const message = input.updatedContent.trim();
  if (message === "") {
    throw new Error("Updated content is empty");
  }

  const trimmedSessionId = input.sessionId.trim();
  if (trimmedSessionId === "") {
    throw new Error("Session id is required");
  }
  if (!UUID_V4_RE.test(trimmedSessionId)) {
    throw new Error("Invalid session id");
  }

  const pruned = await softDeleteChatsAfter({
    sessionId: trimmedSessionId,
    chatId: input.chatId,
    updatedContent: message,
  });
  if (!pruned.ok) {
    throw new Error(pruned.error);
  }

  const recentRows = await fetchRecentChatBySessionId(trimmedSessionId, 10);

  return streamGeminiChatReply({
    apiKey,
    model: input.model,
    resolvedSessionId: trimmedSessionId,
    userChatId: pruned.chatId,
    message,
    recentRows,
  });
}

/** Soft-deletes this user turn and all following rows in the session (DB); client trims its list. */
export async function deleteUserMessageAndFollowing(
  sessionId: string,
  chatId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedSessionId = sessionId.trim();
  if (trimmedSessionId === "") {
    return { ok: false, error: "Session id is required" };
  }
  if (!UUID_V4_RE.test(trimmedSessionId)) {
    return { ok: false, error: "Invalid session id" };
  }
  if (!Number.isInteger(chatId) || chatId < 1) {
    return { ok: false, error: "Invalid chat id" };
  }

  const result = await softDeleteChatsFrom({
    sessionId: trimmedSessionId,
    chatId,
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true };
}
