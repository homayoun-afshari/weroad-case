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

/** The history to send for a turn: the server needs it to end with the user's message, so the errors after it (a retry) are left out. */
export function withoutTrailingErrors(entries: ChatEntry[]): ChatEntry[] {
  let end = entries.length;
  while (end > 0 && entries[end - 1].kind === "error") end--;
  return entries.slice(0, end);
}

/**
 * The chat history as the model reads it. Errors stay in the history (to be counted and studied) but
 * are not sent, and neither are page cards: their events reach the model through the user message
 * after them. A hand-over question is not sent either, except its "no" (a pending question locks the
 * chat, and a "yes" closes it). The conversation starts at the first user message: the first assistant message is
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
    } else if (entry.kind === "handover" && entry.answer === "no") {
      // The user declined the offer; say so, or the agent may offer again
      messages.push({ role: "user", content: "No, thank you. I don't want to connect to a human agent." });
    }
  }
  return messages;
}
