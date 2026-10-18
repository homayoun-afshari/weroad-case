import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { getModel } from "@/lib/agent/model";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { runTurn } from "@/lib/agent/turn";
import { addUserMessage } from "@/lib/chat/history";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, textReply, toolCall } from "./mockModel";

vi.mock("@/lib/agent/model", () => ({ getModel: vi.fn() }));

const northern = pageStateFor({ text: "northern lights" });
const onScreen = northern.results.map((r) => r.tripId);
const entries = addUserMessage([{ kind: "assistant", text: "Hi." }], "hello", northern);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("what a turn used", () => {
  it("adds up the model calls of the turn", async () => {
    // a tool call and an answer: two model calls, one input and one output token each
    const model = mockModel(toolCall("get_faq", {}), textReply("Done."));
    const result = await runTurn({ model, onScreen, entries });
    expect(result.usage).toEqual({ inputTokens: 2, outputTokens: 2, reasoningTokens: 0 });
  });

  it("counts the reasoning tokens, which are part of the output tokens", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: "Hello." }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 50, text: 30, reasoning: 20 },
        },
        warnings: [],
      }),
    });
    const result = await runTurn({ model, onScreen, entries });
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50, reasoningTokens: 20 });
  });

  it("is not sent to the browser: the route answers the entries and the page only", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("Hello.")));
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ entries, onScreen }) }));
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["entries", "page"]);
  });
});

describe("what the eval can set", () => {
  it("uses the system prompt unless told another", async () => {
    const plain = mockModel(textReply("Hello."));
    await runTurn({ model: plain, onScreen, entries });
    expect(JSON.stringify(plain.doGenerateCalls[0].prompt)).toContain(SYSTEM_PROMPT.slice(0, 60));

    const variant = mockModel(textReply("Hello."));
    await runTurn({ model: variant, onScreen, entries, instructions: "You are a test variant." });
    const prompt = JSON.stringify(variant.doGenerateCalls[0].prompt);
    expect(prompt).toContain("You are a test variant.");
    expect(prompt).not.toContain(SYSTEM_PROMPT.slice(0, 60));
  });

  it("passes the reasoning setting to the model, and leaves it to the model's default otherwise", async () => {
    const low = mockModel(textReply("Hello."));
    await runTurn({ model: low, onScreen, entries, reasoning: "low" });
    expect(low.doGenerateCalls[0].reasoning).toBe("low");

    const plain = mockModel(textReply("Hello."));
    await runTurn({ model: plain, onScreen, entries });
    expect(plain.doGenerateCalls[0].reasoning).toBeUndefined();
  });
});
