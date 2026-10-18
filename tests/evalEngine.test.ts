import { beforeEach, describe, expect, it, vi } from "vitest";
import { CASES, type EvalCase, type TurnSpec } from "@/evals/cases";
import { costOf, judge, playCase, summarize, toolsCalled, type Observation, type Outcome } from "@/evals/engine";
import { FAQ_CASES } from "@/evals/faqCases";
import { VARIANTS } from "@/evals/variants";
import { getModel } from "@/lib/agent/model";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, sayAndCall, textReply, toolCall } from "./mockModel";

vi.mock("@/lib/agent/model", () => ({ getModel: vi.fn() }));

const usage = { inputTokens: 1000, outputTokens: 100, reasoningTokens: 20 };
const obs = (over: Partial<Observation> = {}): Observation => ({ tools: [], page: null, answer: "Hello.", handOver: false, usage, ms: 1000, ...over });
const spec = (over: Partial<TurnSpec> = {}): TurnSpec => ({ say: "x", tools: { exactly: [] }, ...over });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the tools a turn called", () => {
  it("are read from the entries it added, in order", () => {
    const entries: ChatEntry[] = [
      {
        kind: "tools",
        messages: [
          { role: "assistant", content: [{ type: "tool-call", toolCallId: "1", toolName: "get_faq", input: {} }] },
          { role: "tool", content: [{ type: "tool-result", toolCallId: "1", toolName: "get_faq", output: { type: "text", value: "ok" } }] },
          { role: "assistant", content: [{ type: "text", text: "Sorry." }, { type: "tool-call", toolCallId: "2", toolName: "hand_over", input: {} }] },
        ],
      },
      { kind: "assistant", text: "Done." },
    ];
    expect(toolsCalled(entries)).toEqual(["get_faq", "hand_over"]);
    expect(toolsCalled([{ kind: "assistant", text: "Hi." }])).toEqual([]);
  });
});

describe("judging a turn against what it should do", () => {
  it("passes a turn that did what its case says", () => {
    expect(judge(spec({ tools: { exactly: ["get_departures"] }, page: "unchanged" }), obs({ tools: ["get_departures"] }))).toEqual([]);
  });

  it("fails the tools: wrong ones, extra ones, missing ones", () => {
    expect(judge(spec({ tools: { exactly: ["get_departures"] } }), obs({ tools: ["search_trips"] }))[0]).toMatch(/^tools: called search_trips, expected exactly get_departures/);
    expect(judge(spec({ tools: { exactly: ["get_departures"] } }), obs({ tools: ["get_departures", "get_faq"] }))[0]).toMatch(/^tools:/);
    expect(judge(spec({ tools: { includes: ["get_faq", "hand_over"] } }), obs({ tools: ["get_faq"] }))[0]).toMatch(/missing hand_over/);
    expect(judge(spec({ tools: { includes: ["get_faq"] } }), obs({ tools: ["get_faq", "hand_over"] }))).toEqual([]);
    expect(judge(spec({ tools: { exactly: [] } }), obs({ tools: ["get_faq"] }))[0]).toMatch(/^tools:/);
  });

  it("fails a page that changed when it should not, and one that didn't when it should", () => {
    const page = pageStateFor({ text: "iceland" });
    expect(judge(spec({ page: "unchanged" }), obs({ page }))).toEqual(["page: changed, expected unchanged"]);
    expect(judge(spec({ page: "changed" }), obs({ page: null }))).toEqual(["page: unchanged, expected a new search"]);
    expect(judge(spec({ page: "changed" }), obs({ page }))).toEqual([]);
  });

  it("adds the lines of the case's own check, and the FAQ breaches", () => {
    expect(judge(spec({ check: () => ["max price is 1800, not 1500"] }), obs())).toEqual(["check: max price is 1800, not 1500"]);
    const visa = spec({ faq: "visa" });
    expect(judge(visa, obs({ answer: "I can't find visa information here." }))).toEqual([]);
    expect(judge(visa, obs({ answer: "I can't find it. Ask your embassy." }))[0]).toMatch(/^faq: claims/);
  });

  it("fails a hand-over turn that promises the connection, and only then", () => {
    expect(judge(spec(), obs({ handOver: true, answer: "I'll connect you with a human agent." }))).toEqual(["promise: the answer promises the connection"]);
    expect(judge(spec(), obs({ handOver: true, answer: "I can offer a human agent." }))).toEqual([]);
    expect(judge(spec(), obs({ handOver: false, answer: "I'll connect you with the page." }))).toEqual([]);
  });

  it("accepts any one of the tools of an anyOf spec", () => {
    const either = spec({ tools: { anyOf: ["search_trips", "get_departures"] } });
    expect(judge(either, obs({ tools: ["get_departures"] }))).toEqual([]);
    expect(judge(either, obs({ tools: ["search_trips"] }))).toEqual([]);
    expect(judge(either, obs({ tools: ["get_faq"] }))[0]).toMatch(/expected one of search_trips, get_departures/);
  });
});

describe("the summary of a run", () => {
  const outcome = (over: Partial<Outcome> = {}): Outcome => ({
    case: "c", run: 1, turn: 1, say: "x", observation: obs(), failures: [], ungrounded: { prices: [], dates: [] }, stale: [], review: false, ...over,
  });

  it("counts clean turns, failures by kind, errors by status, and the answers that state what no source does", () => {
    const summary = summarize("v", [
      outcome(),
      outcome({ failures: ["tools: x", "page: y"] }),
      outcome({ failures: ["faq: z"], ungrounded: { prices: [1759], dates: [] } }),
      outcome({ observation: undefined, error: { status: 502, message: "m", name: "TurnError" }, failures: ["error: 502 m"] }),
      outcome({ observation: undefined, error: { status: 502, message: "m", name: "TurnError" }, failures: ["error: 502 m"] }),
      outcome({ failures: ["promise: p"], observation: obs({ handOver: true }) }),
    ]);
    expect(summary.turns).toBe(6);
    expect(summary.clean).toBe(1);
    expect(summary.failuresByKind).toEqual({ tools: 1, page: 1, faq: 1, error: 2, promise: 1 });
    expect(summary.errors).toEqual({ total: 2, byStatus: { 502: 2 } });
    expect(summary.ungroundedTurns).toBe(1);
    expect(summary.promisesChecked).toBe(1);
    expect(summary.promises).toBe(1);
  });

  it("adds up the tokens and prices them as Haiku 5.5 does, and times the turns", () => {
    const summary = summarize("v", [outcome({ observation: obs({ ms: 1000 }) }), outcome({ observation: obs({ ms: 3000 }) })]);
    expect(summary.tokens).toEqual({ inputTokens: 2000, outputTokens: 200, reasoningTokens: 40 });
    expect(summary.latency).toEqual({ meanMs: 2000, maxMs: 3000 });
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 0, reasoningTokens: 0 })).toBeCloseTo(0.1);
    expect(costOf({ inputTokens: 0, outputTokens: 1_000_000, reasoningTokens: 0 })).toBeCloseTo(0.5);
    expect(summary.cost).toBeCloseTo(2000 * 0.1e-6 + 200 * 0.5e-6);
  });
});

describe("playing a case", () => {
  const twoTurns: EvalCase = {
    id: "two",
    opening: { text: "northern lights" },
    turns: [
      { say: "I only have 19-24 October", tools: { exactly: ["get_departures"] }, page: "unchanged" },
      { say: "yes please", tools: { includes: ["search_trips"] }, page: "changed", check: (o) => (o.page?.request.text === "" ? [] : ["text kept"]) },
    ],
  };

  it("plays the turns in order as the browser would: each turn sees the tool results and the page of the one before", async () => {
    const model = mockModel(
      toolCall("get_departures", { from: "2026-10-19", to: "2026-10-24" }),
      textReply("Nothing fits. Shall I look at all trips?"),
      sayAndCall("Looking.", "search_trips", { text: "", dates: { from: "2026-10-19", to: "2026-10-24" } }),
      textReply("The page now shows the nearest options."),
    );
    vi.mocked(getModel).mockReturnValue(model);
    const outcomes = await playCase(twoTurns, 1, { name: "t", runs: 1 });

    expect(outcomes.map((o) => o.turn)).toEqual([1, 2]);
    expect(outcomes.map((o) => o.failures)).toEqual([[], []]);
    // the third model call (turn 2) was given turn 1's tool call and answer
    const prompt = JSON.stringify(model.doGenerateCalls[2].prompt);
    expect(prompt).toContain("get_departures");
    expect(prompt).toContain("Shall I look at all trips?");
    expect(prompt).toContain("yes please");
    expect(outcomes[1].observation?.page?.results.length).toBeGreaterThan(0);
  });

  it("applies the strict check to what each turn wrote", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("Sweden is from €1,759, and Spain from €7,777.")));
    const [outcome] = await playCase({ id: "g", opening: { text: "northern lights" }, turns: [{ say: "hi", tools: { exactly: [] }, page: "unchanged" }] }, 1, { name: "t", runs: 1 });
    // €1,759 is on the page (the user message carries it); €7,777 is on no source
    expect(outcome.ungrounded).toEqual({ prices: [7777], dates: [] });
  });

  it("records a failed turn as the error the user would read, and stops the case", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("")));
    const outcomes = await playCase(twoTurns, 1, { name: "t", runs: 1 });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].error).toMatchObject({ status: 502, name: "TurnError" });
    expect(outcomes[0].failures[0]).toMatch(/^error: 502/);
  });

  it("gives the model the variant's prompt and reasoning setting", async () => {
    const model = mockModel(textReply("Hello."));
    vi.mocked(getModel).mockReturnValue(model);
    await playCase({ id: "v", opening: { text: "northern lights" }, turns: [{ say: "hi", tools: { exactly: [] } }] }, 1, { name: "t", runs: 1, instructions: "A variant prompt.", reasoning: "low" });
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("A variant prompt.");
    expect(model.doGenerateCalls[0].reasoning).toBe("low");
  });
});

describe("the cases and the variants", () => {
  it("have 22 cases with unique ids, each with a turn", () => {
    expect(CASES).toHaveLength(22);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(22);
    expect(CASES.every((c) => c.turns.length > 0 && c.turns.every((t) => t.say.length > 0))).toBe(true);
  });

  it("point only at FAQ cases that exist, and cover each of them", () => {
    const used = CASES.flatMap((c) => c.turns.map((t) => t.faq)).filter(Boolean);
    expect(used.every((id) => FAQ_CASES.some((f) => f.id === id))).toBe(true);
    expect(new Set(used)).toEqual(new Set(FAQ_CASES.map((f) => f.id)));
  });

  it("include the brief's examples, the stale-trips cases and the two-turn case", () => {
    const ids = CASES.map((c) => c.id);
    for (const id of ["departures-window", "usa", "brazil-argentina", "new-years-eve", "narrow-cooking", "any-period", "suggestions-argentina", "offer-then-yes", "cheaper"]) expect(ids).toContain(id);
  });

  it("run the baseline with the app's own prompt, and the others with one thing changed", () => {
    expect(VARIANTS.baseline.instructions).toBeUndefined();
    expect(VARIANTS.baseline.reasoning).toBeUndefined();
    expect(VARIANTS["low-reasoning"]).toMatchObject({ reasoning: "low" });
    expect(VARIANTS["low-reasoning"].instructions).toBeUndefined();
    expect(VARIANTS.rules.instructions?.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(VARIANTS.rules.instructions).toContain("Mention only trips that the page shows now");
    expect(VARIANTS.rules.instructions).toContain("not recommendations");
    expect(VARIANTS.rules.reasoning).toBeUndefined();
  });
});
