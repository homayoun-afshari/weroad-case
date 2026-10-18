import { generateText, hasToolCall, isStepCount, type LanguageModel } from "ai";
import { toModelMessages } from "@/lib/chat/history";
import type { ChatEntry, TurnResponse } from "@/lib/chat/types";
import { SYSTEM_PROMPT } from "./prompt";
import { createTools, type TurnPage } from "./tools";

/** A turn has a fixed maximum of model calls, so its cost and time are bounded. */
export const MAX_STEPS = 5;
export const TURN_TIMEOUT_MS = 30_000;

/** The turn ended without an answer for the user (for example, the step limit came first). */
export class TurnError extends Error {}

/** What a turn used, over all its model calls. `reasoningTokens` are part of `outputTokens`. */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

/** A turn's response, and what it used (the route sends the response only; the eval reads the usage). */
export type TurnResult = TurnResponse & { usage: TurnUsage };

/** One turn: the chat history ends with a user message; the agent calls tools and writes its answer. */
export async function runTurn(options: {
  model: LanguageModel;
  entries: ChatEntry[];
  /** The ids of the trips on the page, in its order. */
  onScreen: number[];
  abortSignal?: AbortSignal;
  /** How long the whole turn may take; the default is TURN_TIMEOUT_MS. */
  timeoutMs?: number;
  /** The system prompt; the default is SYSTEM_PROMPT. The eval sets it to measure a variant. */
  instructions?: string;
  /** How much the model reasons; the model's own default when left out. The eval sets it to measure it. */
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
}): Promise<TurnResult> {
  const turn: TurnPage = { page: null, handOver: false };
  const result = await generateText({
    model: options.model,
    instructions: options.instructions ?? SYSTEM_PROMPT,
    messages: toModelMessages(options.entries),
    tools: createTools(turn, options.onScreen),
    // Offering a human agent ends the turn: the sentence written with the call is the message, and the page asks
    stopWhen: [isStepCount(MAX_STEPS), hasToolCall("hand_over")],
    timeout: options.timeoutMs ?? TURN_TIMEOUT_MS,
    reasoning: options.reasoning,
    maxRetries: 1,
    abortSignal: options.abortSignal,
  });

  // `result.response.messages` holds only the last step; the turn's messages are the steps' together
  const messages = result.steps.flatMap((step) => step.response.messages);
  // The answer is the text of the last step that has any: after a tool the model sometimes ends with an
  // empty step, having written its sentence together with the tool call
  const written = result.steps.map((step) => step.text.trim()).filter(Boolean);
  const text = written[written.length - 1] ?? "";
  // A hand-over turn needs no sentence: the question is the proposal itself
  if (!text && !turn.handOver) throw new TurnError("The agent ended its turn without an answer.");

  // The final assistant message, when it is the answer, is shown rather than kept with the tool calls
  const last = messages[messages.length - 1];
  const answered = last?.role === "assistant" && result.steps[result.steps.length - 1].text.trim() === text;
  const entries: ChatEntry[] = [];
  const kept = answered ? messages.slice(0, -1) : messages;
  if (kept.length > 0) entries.push({ kind: "tools", messages: kept });
  if (text) entries.push({ kind: "assistant", text });
  if (turn.handOver) entries.push({ kind: "handover", answer: "asked" });
  const usage: TurnUsage = {
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
    reasoningTokens: result.totalUsage.outputTokenDetails?.reasoningTokens ?? 0,
  };
  return { entries, page: turn.page, usage };
}
