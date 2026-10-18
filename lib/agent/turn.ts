import { generateText, isStepCount, type LanguageModel } from "ai";
import { toModelMessages } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import type { PageState } from "@/lib/page/types";
import { SYSTEM_PROMPT } from "./prompt";
import { createTools, type TurnPage } from "./tools";

/** A turn has a fixed maximum of model calls, so its cost and time are bounded. */
export const MAX_STEPS = 5;
export const TURN_TIMEOUT_MS = 30_000;

/** The turn ended without an answer for the user (for example, the step limit came first). */
export class TurnError extends Error {}

export interface TurnResult {
  /** To append to the chat history: the tool calls and results of the turn, then the assistant message. */
  entries: ChatEntry[];
  /** The page after the turn, when the agent searched. The client applies it as the assistant's change. */
  page: PageState | null;
}

/** One turn: the chat history ends with a user message; the agent calls tools and writes its answer. */
export async function runTurn(options: {
  model: LanguageModel;
  entries: ChatEntry[];
  abortSignal?: AbortSignal;
}): Promise<TurnResult> {
  const turn: TurnPage = { page: null };
  const result = await generateText({
    model: options.model,
    instructions: SYSTEM_PROMPT,
    messages: toModelMessages(options.entries),
    tools: createTools(turn),
    stopWhen: isStepCount(MAX_STEPS),
    timeout: TURN_TIMEOUT_MS,
    maxRetries: 1,
    abortSignal: options.abortSignal,
  });

  // `result.response.messages` holds only the last step; the turn's messages are the steps' together
  const messages = result.steps.flatMap((step) => step.response.messages);
  const text = result.text.trim();
  if (!text || messages[messages.length - 1]?.role !== "assistant") {
    throw new TurnError("The agent ended its turn without an answer.");
  }

  const entries: ChatEntry[] = [];
  if (messages.length > 1) entries.push({ kind: "tools", messages: messages.slice(0, -1) });
  entries.push({ kind: "assistant", text });
  return { entries, page: turn.page };
}
