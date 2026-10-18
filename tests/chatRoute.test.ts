import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { getModel } from "@/lib/agent/model";
import { addUserMessage } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, textReply, toolCall } from "./mockModel";

vi.mock("@/lib/agent/model", () => ({ getModel: vi.fn() }));

const page = pageStateFor({ text: "northern lights" });
const entries: ChatEntry[] = addUserMessage([{ kind: "assistant", text: "Hi." }], "max 1,500", page);
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** A model whose call fails with this error. */
const failingModel = (error: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw error;
    },
  });

describe("POST /api/chat", () => {
  it("runs a turn and returns the new entries and the page", async () => {
    vi.mocked(getModel).mockReturnValue(
      mockModel(toolCall("search_trips", { text: "northern lights", maxPrice: 1500 }), textReply("One trip left.")),
    );
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries.map((e: ChatEntry) => e.kind)).toEqual(["tools", "assistant"]);
    expect(body.page.results.map((r: { tripId: number }) => r.tripId)).toEqual([9]);
  });

  it("rejects a body that is not JSON, or not a chat history", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ entries: [{ kind: "mystery" }], onScreen: [] })).status).toBe(400);
    expect((await post({ entries })).status).toBe(400); // no trips on screen given
  });

  it("takes the hand-over question in the history, and rejects a wrong answer", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("Sure.")));
    const withQuestion = [...entries.slice(0, 1), { kind: "handover", answer: "no" }, ...entries.slice(1)];
    expect((await post({ entries: withQuestion, onScreen: [9] })).status).toBe(200);
    const wrong = [...entries.slice(0, 1), { kind: "handover", answer: "maybe" }, ...entries.slice(1)];
    expect((await post({ entries: wrong, onScreen: [9] })).status).toBe(400);
  });

  it("rejects a history that doesn't end with a user message", async () => {
    for (const bad of [[], [...entries, { kind: "assistant", text: "Done." }], [...entries, { kind: "error", text: "x" }]]) {
      const response = await post({ entries: bad, onScreen: [9] });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "The chat must end with a user message." });
    }
    expect(getModel).not.toHaveBeenCalled();
  });

  it("answers a failure that retrying won't fix (a bad key, a missing setting) with a clear message and no internals", async () => {
    vi.mocked(getModel).mockImplementation(() => {
      throw new Error("ANTHROPIC_API_KEY is not set");
    });
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The assistant isn't available right now. Please try again later." });
  });

  it("answers a turn that ends without an answer with its own message", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("")));
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The assistant couldn't finish its answer. Please try again." });
  });

  it("says the assistant is busy when the provider is overloaded or rate limiting", async () => {
    for (const statusCode of [429, 529]) {
      vi.mocked(getModel).mockReturnValue(failingModel(new APICallError({ message: "secret overloaded detail", url: "x", requestBodyValues: {}, statusCode, isRetryable: false })));
      const response = await post({ entries, onScreen: [9, 11, 41] });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "The assistant is busy right now. Please try again in a moment." });
    }
  });

  it("says the assistant took too long when the turn times out", async () => {
    vi.mocked(getModel).mockReturnValue(failingModel(new DOMException("The operation was aborted due to timeout", "TimeoutError")));
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "The assistant took too long to answer. Please try again." });
  });

  it("logs the detail of a failure and sends none of it", async () => {
    vi.mocked(getModel).mockReturnValue(failingModel(new APICallError({ message: "secret provider detail", url: "x", requestBodyValues: {}, statusCode: 401, isRetryable: false })));
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(JSON.stringify(await response.json())).not.toContain("secret provider detail");
    expect(console.error).toHaveBeenCalledWith("chat turn failed", expect.anything());
  });

  it("answers a stop with nothing and logs nothing: the user left", async () => {
    const controller = new AbortController();
    vi.mocked(getModel).mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: (options) =>
          new Promise((_, reject) => {
            options.abortSignal?.addEventListener("abort", () => reject(options.abortSignal?.reason));
          }) as never,
      }),
    );
    const pending = POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ entries, onScreen: [9, 11, 41] }), signal: controller.signal }));
    setTimeout(() => controller.abort(), 40);
    const response = await pending;
    expect(response.status).toBe(499);
    expect(await response.text()).toBe("");
    expect(console.error).not.toHaveBeenCalled();
  });
});
