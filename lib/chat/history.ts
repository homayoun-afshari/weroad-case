import type { ModelMessage } from "ai";
import type { PageState } from "@/lib/page/types";
import { pageBlocks } from "./blocks";
import type { ChatEntry, PageEvent } from "./types";

/** A user message with the page events since the last one, then the page state at this moment. */
export function userEntry(text: string, events: PageEvent[], page: PageState): ChatEntry {
  return { kind: "user", text, blocks: pageBlocks(events, page) };
}

/** Adds a page event to the chat: to the card at the end of the history if there is one, else to a new card. */
export function recordEvent(entries: ChatEntry[], event: PageEvent): ChatEntry[] {
  const last = entries[entries.length - 1];
  if (last?.kind === "page") return [...entries.slice(0, -1), { kind: "page", events: [...last.events, event] }];
  return [...entries, { kind: "page", events: [event] }];
}

/** Adds the user's message. The events of the card before it, if any, go into its page context. */
export function addUserMessage(entries: ChatEntry[], text: string, page: PageState): ChatEntry[] {
  const last = entries[entries.length - 1];
  const events = last?.kind === "page" ? last.events : [];
  return [...entries, userEntry(text, events, page)];
}

/**
 * The chat history as the model reads it. Errors stay in the history (to be counted and studied) but
 * are not sent, and neither are page cards: their events reach the model through the user message
 * after them. The conversation starts at the first user message: the first assistant message is
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
