import type { ModelMessage } from "ai";
import type { PageState, Source } from "@/lib/page/types";
import type { SearchRequest } from "@/lib/search/types";

/** A change to the page that the agent didn't make. They are recorded as they happen, and emptied into the next user message. */
export type PageEvent =
  /** The user pressed the search button. */
  | { kind: "search"; request: SearchRequest; count: number; suggested?: boolean }
  /** The user pressed the undo button: what was undone, whose change it was, and where the page went back to. */
  | { kind: "undo"; reversed: Source; undone: SearchRequest; restored: SearchRequest }
  /**
   * The search controls differ from the page's search and haven't been searched: `draft` is the request
   * they describe. `null` means they are back to the page's search after the agent was told of a draft.
   * Only the last one is kept.
   */
  | { kind: "controls"; draft: SearchRequest | null };

/**
 * The chat history, oldest first. Only user messages, assistant messages and errors appear in the chat;
 * `tools` holds the tool calls and results of a turn, which the model needs on the next turn.
 */
export type ChatEntry =
  /** `text` is what the user wrote and the chat shows; `blocks` is the page context the model reads before it. */
  | { kind: "user"; text: string; blocks: string }
  /** Written by the model, or by code (the first message). */
  | { kind: "assistant"; text: string }
  /** The assistant's tool calls and the tool results of one turn, as the AI SDK holds them. */
  | { kind: "tools"; messages: ModelMessage[] }
  /**
   * A page changes card: the page events of one run, shown in the chat. The model never reads it
   * directly; its events go into the `blocks` of the user message that follows.
   */
  | { kind: "page"; events: PageEvent[] }
  /**
   * The question "Do you want to connect to a human agent?", asked by the page when the agent can't
   * answer. `asked` waits for the user; `yes` freezes the chat; `no` closes the question.
   */
  | { kind: "handover"; answer: "asked" | "yes" | "no" }
  | { kind: "error"; text: string };

/** What a chat turn answers with. */
export interface TurnResponse {
  /** To append to the chat history: the tool calls and results of the turn, then the assistant message. */
  entries: ChatEntry[];
  /** The page after the turn, when the agent searched. The client applies it as the assistant's change. */
  page: PageState | null;
}
