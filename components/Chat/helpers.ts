import { ChatRole } from "@/lib/ai";

/** Row shape for client chat state; matches {@link ChatMessage} in `chat.tsx`. */
export type ChatStreamRow = {
  id: string;
  role: ChatRole;
  content: string;
};

const META_END = "--end-user-chat-id--\n";
const RESPONSE_START = "--start-response--\n";
const RESPONSE_END = "--end-response--\n";

function parseMetaBlock(block: string): {
  sessionId: string;
  userChatId: string;
} | null {
  const sessionMatch = block.match(
    /--start-session-id--\n([^\n]+)\n--end-session-id--/,
  );
  const userMatch = block.match(
    /--start-user-chat-id--\n(\d+)\n--end-user-chat-id--/,
  );
  if (!sessionMatch?.[1] || !userMatch?.[1]) return null;
  return { sessionId: sessionMatch[1].trim(), userChatId: userMatch[1] };
}

function stripIncompleteTrailingMarker(s: string, marker: string): string {
  const max = Math.min(s.length, marker.length - 1);
  for (let i = max; i >= 1; i--) {
    const suffix = s.slice(-i);
    if (marker.startsWith(suffix)) {
      return s.slice(0, -i);
    }
  }
  return s;
}

function visibleAssistantContent(buffer: string): string {
  const startIdx = buffer.indexOf(RESPONSE_START);
  if (startIdx === -1) {
    return "";
  }
  const afterStart = buffer.slice(startIdx + RESPONSE_START.length);
  const endIdx = afterStart.indexOf(RESPONSE_END);
  if (endIdx === -1) {
    return stripIncompleteTrailingMarker(afterStart, RESPONSE_END);
  }
  return afterStart.slice(0, endIdx);
}

export async function pumpGeminiChatStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    userPendingId: string;
    assistantPendingId: string;
    userMessageIdForRollback: { current: string };
    setSessionId: (sessionId: string) => void;
    setMessages: (
      u: ChatStreamRow[] | ((p: ChatStreamRow[]) => ChatStreamRow[]),
    ) => void;
  },
): Promise<void> {
  const {
    userPendingId,
    assistantPendingId,
    userMessageIdForRollback,
    setSessionId,
    setMessages,
  } = options;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let preMeta = "";
  let postMeta = "";
  let metaDone = false;

  const applyAssistantContent = (body: string) => {
    const visible = visibleAssistantContent(body);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantPendingId ? { ...m, content: visible } : m,
      ),
    );
  };

  while (true) {
    const { done, value } = await reader.read();

    const chunk = decoder.decode(value ?? new Uint8Array(), {
      stream: !done,
    });
    if (!metaDone) {
      preMeta += chunk;
      const endIdx = preMeta.indexOf(META_END);
      if (endIdx !== -1) {
        const metaBlock = preMeta.slice(0, endIdx + META_END.length);
        const parsed = parseMetaBlock(metaBlock);
        if (!parsed) {
          throw new Error("Invalid chat stream metadata");
        }
        setSessionId(parsed.sessionId);
        userMessageIdForRollback.current = parsed.userChatId;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userPendingId ? { ...m, id: parsed.userChatId } : m,
          ),
        );
        metaDone = true;
        postMeta = preMeta.slice(endIdx + META_END.length);
        if (postMeta.length > 0) applyAssistantContent(postMeta);
      }
    } else {
      postMeta += chunk;
      applyAssistantContent(postMeta);
    }

    if (done) {
      break;
    }
  }
}
