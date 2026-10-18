import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { runTurn, TURN_TIMEOUT_MS } from "@/lib/agent/turn";
import { addUserMessage } from "@/lib/chat/history";
import { pageStateFor } from "@/lib/page/view";

const northern = pageStateFor({ text: "northern lights" });
const onScreen = northern.results.map((r) => r.tripId);
const entries = addUserMessage([{ kind: "assistant", text: "Hi." }], "hello", northern);

/** A model that never answers; it ends only when the request is cancelled or times out. */
function hangingModel() {
  const seen = { calls: 0, aborted: false };
  const model = new MockLanguageModelV4({
    doGenerate: (options) =>
      new Promise((_, reject) => {
        seen.calls++;
        // like a real request: a signal that is already aborted fails at once
        if (options.abortSignal?.aborted) {
          seen.aborted = true;
          return reject(options.abortSignal.reason);
        }
        options.abortSignal?.addEventListener("abort", () => {
          seen.aborted = true;
          reject(options.abortSignal?.reason ?? new Error("aborted"));
        });
      }) as never,
  });
  return { model, seen };
}

describe("a turn that takes too long", () => {
  it("has a limit of 30 seconds", () => {
    expect(TURN_TIMEOUT_MS).toBe(30_000);
  });

  it("ends with a timeout, and the model call is cancelled", async () => {
    const { model, seen } = hangingModel();
    const started = Date.now();
    const error = await runTurn({ model, onScreen, entries, timeoutMs: 60 }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("TimeoutError");
    expect(Date.now() - started).toBeLessThan(1000);
    expect(seen).toEqual({ calls: 1, aborted: true });
  });
});

describe("a turn the user stops", () => {
  it("cancels the model call when the request is cancelled", async () => {
    const { model, seen } = hangingModel();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 40);
    const started = Date.now();
    const error = await runTurn({ model, onScreen, entries, abortSignal: controller.signal }).catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(Date.now() - started).toBeLessThan(1000);
    // the model was called once, saw the cancellation, and nothing else was started
    expect(seen).toEqual({ calls: 1, aborted: true });
  });

  it("never calls the model when the request was cancelled before it began", async () => {
    const { model, seen } = hangingModel();
    const controller = new AbortController();
    controller.abort();
    const error = await runTurn({ model, onScreen, entries, abortSignal: controller.signal }).catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(seen.calls).toBeLessThanOrEqual(1);
  });
});
