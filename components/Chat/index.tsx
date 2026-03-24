"use client";

import { chat, deleteUserMessageAndFollowing, updateChat } from "@/actions/ai";
import { ChatRole, Model } from "@/lib/ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssistantMessageItem } from "./AssistantMessageItem";
import { UserMessageItem } from "./UserMessageItem";
import { pumpGeminiChatStream } from "./helpers";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<Model>(Model.GEMINI_3_FLASH_PREVIEW);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || isStreaming) return;

      const userPendingId = `pending-user-${crypto.randomUUID()}`;
      const assistantPendingId = `pending-assistant-${crypto.randomUUID()}`;
      const userMessageIdForRollback = { current: userPendingId };

      setIsStreaming(true);
      setMessages((prev) => [
        ...prev,
        { id: userPendingId, role: ChatRole.User, content: trimmed },
        {
          id: assistantPendingId,
          role: ChatRole.Assistant,
          content: "",
        },
      ]);

      try {
        const stream = await chat(model, trimmed, sessionId);
        if (!(stream instanceof ReadableStream)) {
          throw new Error("Expected a readable stream from chat");
        }

        await pumpGeminiChatStream(stream, {
          userPendingId,
          assistantPendingId,
          userMessageIdForRollback,
          setSessionId,
          setMessages,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) => {
          const rest = prev.filter(
            (m) =>
              m.id !== userMessageIdForRollback.current &&
              m.id !== assistantPendingId,
          );
          return [
            ...rest,
            {
              id: `error-${crypto.randomUUID()}`,
              role: ChatRole.Assistant,
              content: message,
            },
          ];
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, model, sessionId],
  );

  const submitUserEdit = useCallback(
    async (id: string, content: string) => {
      const trimmed = content.trim();
      if (trimmed === "" || isStreaming) return;

      const persistedUser = /^\d+$/.test(id);
      if (!sessionId || !persistedUser) {
        setMessages((prev) =>
          prev.map((x) => (x.id === id ? { ...x, content: trimmed } : x)),
        );
        return;
      }

      const snapshot = messagesRef.current;
      const idx = snapshot.findIndex((m) => m.id === id);
      if (idx === -1) return;

      const assistantPendingId = `pending-assistant-${crypto.randomUUID()}`;
      const userMessageIdForRollback = { current: id };

      setIsStreaming(true);
      setMessages((_prev) => {
        const head = snapshot
          .slice(0, idx + 1)
          .map((m, i) => (i === idx ? { ...m, content: trimmed } : m));
        return [
          ...head,
          { id: assistantPendingId, role: ChatRole.Assistant, content: "" },
        ];
      });

      try {
        const stream = await updateChat({
          sessionId,
          chatId: Number(id),
          model,
          updatedContent: trimmed,
        });
        if (!(stream instanceof ReadableStream)) {
          throw new Error("Expected a readable stream from updateChat");
        }

        await pumpGeminiChatStream(stream, {
          userPendingId: id,
          assistantPendingId,
          userMessageIdForRollback,
          setSessionId,
          setMessages,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setMessages([
          ...snapshot,
          {
            id: `error-${crypto.randomUUID()}`,
            role: ChatRole.Assistant,
            content: message,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, model, sessionId],
  );

  const submitUserDelete = useCallback(
    async (id: string) => {
      if (isStreaming) return;
      const snapshot = messagesRef.current;
      const idx = snapshot.findIndex((m) => m.id === id);
      if (idx === -1) return;

      const persistedUser = /^\d+$/.test(id);
      if (sessionId && persistedUser) {
        const result = await deleteUserMessageAndFollowing(
          sessionId,
          Number(id),
        );
        if (!result.ok) {
          console.error(result.error);
          return;
        }
      }

      setMessages((prev) => prev.slice(0, idx));
    },
    [isStreaming, sessionId],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isStreaming) return;
        setInput("");
        void send(trimmed);
      }
    },
    [input, isStreaming, send],
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-foreground/10 px-4 py-3">
        <h1 className="text-sm font-medium tracking-tight">Chat</h1>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(14rem+env(safe-area-inset-bottom,0px))]"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-foreground/50">
            Send a message to start. Press Enter to send, Shift+Enter for a new
            line.
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((m) =>
              m.role === ChatRole.User ? (
                <UserMessageItem
                  key={m.id}
                  message={m}
                  disableEditing={isStreaming}
                  onUpdateContent={(id, content) => {
                    void submitUserEdit(id, content);
                  }}
                  onSoftDeleteFromHere={(id) => {
                    void submitUserDelete(id);
                  }}
                />
              ) : (
                <AssistantMessageItem
                  key={m.id}
                  message={m}
                  isStreamingPlaceholder={m.content === "" && isStreaming}
                />
              ),
            )}
          </ul>
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 bg-background pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex h-32 flex-col border-t border-foreground/10 px-4 py-3">
          <form
            className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = input.trim();
              if (!trimmed || isStreaming) return;
              setInput("");
              void send(trimmed);
            }}
          >
            <div className="w-full shrink-0">
              <label htmlFor="chat-model" className="text-sm font-medium mr-2">
                Model
              </label>
              <select
                id="chat-model"
                name="model"
                value={model}
                onChange={(e) => setModel(e.target.value as Model)}
                disabled={isStreaming}
                className="h-8 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm text-foreground outline-none ring-foreground/20 focus:border-foreground/25 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"
              >
                <option value={Model.GEMINI_3_FLASH_PREVIEW}>
                  Gemini 3 Flash
                </option>
                <option value={Model.GEMINI_3_1_FLASH_LITE_PREVIEW}>
                  Gemini 3.1 Flash Lite
                </option>
                <option value={Model.GEMINI_3_1_PRO_PREVIEW}>
                  Gemini 3.1 Pro
                </option>
              </select>
            </div>
            <div className="flex min-h-0 w-full flex-1 items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">
                Message
              </label>
              <textarea
                id="chat-input"
                name="message"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isStreaming}
                placeholder="Message…"
                className="max-h-full min-h-11 min-w-0 flex-1 resize-y rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm leading-snug outline-none ring-foreground/20 placeholder:text-foreground/40 focus:border-foreground/25 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="h-11 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:opacity-90"
              >
                {isStreaming ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
