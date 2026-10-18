import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** A model response that calls a tool. */
export const toolCall = (toolName: string, input: unknown, toolCallId = "call-1") => ({
  content: [{ type: "tool-call" as const, toolCallId, toolName, input: JSON.stringify(input) }],
  finishReason: { unified: "tool-calls" as const, raw: undefined },
  usage,
  warnings: [],
});

/** A model response that answers in text. */
export const textReply = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage,
  warnings: [],
});

/** A model that gives these responses in order, one per call. */
export const mockModel = (...responses: ReturnType<typeof toolCall | typeof textReply>[]) =>
  new MockLanguageModelV4({ doGenerate: responses });
