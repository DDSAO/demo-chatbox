"use client";

import { MarkdownComponents } from "@/components/Chat/MarkdownComponents";
import Markdown from "react-markdown";

export type AssistantMessageItemProps = {
  message: {
    id: string;
    content: string;
  };
  /** True when this row is still receiving streamed text. */
  isStreamingPlaceholder: boolean;
};

export function AssistantMessageItem({
  message: m,
  isStreamingPlaceholder,
}: AssistantMessageItemProps) {
  return (
    <li className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-foreground/15 px-3 py-2 text-sm">
        <span className="sr-only">Assistant: </span>
        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {isStreamingPlaceholder ? (
            <p className="whitespace-pre-wrap wrap-break-word leading-snug">
              …
            </p>
          ) : (
            <Markdown components={MarkdownComponents}>{m.content}</Markdown>
          )}
        </div>
      </div>
    </li>
  );
}
