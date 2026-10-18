import type { ModelMessage } from "ai";
import type { PageState } from "@/lib/page/types";
import { pageBlocks } from "./blocks";
import type { ChatEntry, PageEvent } from "./types";

/** A user message with the page events since the last one, then the page state at this moment. */
export function userEntry(text: string, events: PageEvent[], page: PageState): ChatEntry {
  return { kind: "user", text, blocks: pageBlocks(events, page) };
}

/**
 * The chat history as the model reads it. Errors stay in the history (to be counted and studied) but
 * are not sent. The conversation starts at the first user message: the first assistant message is
 * written by code, and that user message already carries the page state it describes.
 */
export function toModelMessages(entries: ChatEntry[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const entry of entries) {
    if (entry.kind === "user") {
      messages.push({ role: "user", content: `${entry.blocks}\n${entry.text}` });
    } else if (messages.length === 0) {
      continue;
    } else if (entry.kind === "assistant") {
      messages.push({ role: "assistant", content: entry.text });
    } else if (entry.kind === "tools") {
      messages.push(...entry.messages);
    }
  }
  return messages;
}
