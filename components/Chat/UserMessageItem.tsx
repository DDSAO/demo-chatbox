"use client";

import { useEffect, useRef, useState, type SVGProps } from "react";
import Markdown from "react-markdown";
import { MarkdownComponents } from "./MarkdownComponents";

export type UserMessageItemProps = {
  message: {
    id: string;
    content: string;
  };
  /** Updates the message in parent state; wire to persistence later if needed. */
  onUpdateContent: (id: string, content: string) => void;
  /** Removes this message and every message after it (client + DB soft-delete when persisted). */
  onSoftDeleteFromHere: (id: string) => void;
  /** When true, hide edit and delete (e.g. while a reply is streaming). */
  disableEditing?: boolean;
};

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function UserMessageItem({
  message: m,
  onUpdateContent,
  onSoftDeleteFromHere,
  disableEditing = false,
}: UserMessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(m.content);
  }, [m.content, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [editing]);

  const startEdit = () => {
    setDraft(m.content);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(m.content);
    setEditing(false);
  };

  const save = () => {
    const next = draft.trim();
    if (next === "") return;
    onUpdateContent(m.id, next);
    setEditing(false);
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <li className="flex justify-end">
      <div className="flex max-w-[85%] items-start gap-0.5">
        {!editing ? (
          <>
            {!disableEditing ? (
              <div className="mt-1 flex shrink-0 gap-0.5">
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md p-1.5 text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                  aria-label="Edit message"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onSoftDeleteFromHere(m.id)}
                  className="rounded-md p-1.5 text-foreground/45 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                  aria-label="Delete this message and everything after it"
                >
                  <TrashIcon />
                </button>
              </div>
            ) : null}
            <div className="rounded-2xl rounded-br-md bg-foreground/10 px-3 py-2 text-sm">
              <span className="sr-only">You: </span>
              <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <Markdown components={MarkdownComponents}>{m.content}</Markdown>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl rounded-br-md border border-foreground/15 bg-foreground/10 p-3 text-sm">
            <label htmlFor={`edit-user-msg-${m.id}`} className="sr-only">
              Edit your message
            </label>
            <textarea
              ref={textareaRef}
              id={`edit-user-msg-${m.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              rows={Math.min(12, Math.max(3, draft.split("\n").length))}
              className="min-h-18 w-full resize-y rounded-md border border-foreground/15 bg-background px-2.5 py-2 text-sm leading-snug text-foreground outline-none ring-foreground/20 placeholder:text-foreground/40 focus:border-foreground/25 focus:ring-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                className="rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={draft.trim() === ""}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <p className="text-[0.65rem] text-foreground/45">
              ⌘/Ctrl+Enter to save · Esc to cancel
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
