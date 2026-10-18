import type { ToolCallPart } from "ai";
import { describeFailure } from "@/lib/agent/errors";
import { getModel } from "@/lib/agent/model";
import { runTurn, type TurnUsage } from "@/lib/agent/turn";
import { firstMessage } from "@/lib/chat/firstMessage";
import { addUserMessage } from "@/lib/chat/history";
import type { ChatEntry, TurnResponse } from "@/lib/chat/types";
import type { PageState } from "@/lib/page/types";
import { pageStateFor } from "@/lib/page/view";
import { groundingSources, promisesHandOver, staleTripsNamed, ungroundedFacts, type Ungrounded } from "./checks";
import { CASES, type EvalCase, type ToolSpec, type TurnSpec } from "./cases";
import { checkFaqAnswer, FAQ_CASES } from "./faqCases";

/** What one turn looked like from outside: the tools called, the new page, what was written. */
export interface Observation {
  tools: string[];
  /** The search the agent formed, when it searched: the request the controls would be filled from. */
  page: PageState | null;
  answer: string;
  handOver: boolean;
  usage: TurnUsage;
  ms: number;
}

export interface Outcome {
  case: string;
  run: number;
  turn: number;
  say: string;
  observation?: Observation;
  /** The turn failed: what the user would have read. */
  error?: { status: number; message: string; name: string };
  /** What went wrong, each line starting with its kind: tools, page, faq, promise, check. */
  failures: string[];
  ungrounded: Ungrounded;
  /** Trips the answer names although the search took them off the page. */
  stale: string[];
  review: boolean;
}

export interface Variant {
  name: string;
  /** The system prompt; the app's own when left out. */
  instructions?: string;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  runs: number;
}

/** Haiku 5.5, per token, for prompts up to 100K tokens. */
const PRICE = { input: 0.1 / 1_000_000, output: 0.5 / 1_000_000 };
export const costOf = (usage: TurnUsage) => usage.inputTokens * PRICE.input + usage.outputTokens * PRICE.output;

/** The tools a turn called, in order, from the entries it added to the chat. */
export function toolsCalled(entries: ChatEntry[]): string[] {
  return entries
    .filter((e) => e.kind === "tools")
    .flatMap((e) => e.messages)
    .flatMap((m) => (m.role === "assistant" && Array.isArray(m.content) ? m.content : []))
    .filter((part): part is ToolCallPart => part.type === "tool-call")
    .map((part) => part.toolName);
}

export function observe(response: TurnResponse, usage: TurnUsage, ms: number): Observation {
  const answer = response.entries.find((e) => e.kind === "assistant");
  return {
    tools: toolsCalled(response.entries),
    page: response.page,
    answer: answer?.kind === "assistant" ? answer.text : "",
    handOver: response.entries.some((e) => e.kind === "handover"),
    usage,
    ms,
  };
}

const sameSet = (a: string[], b: string[]) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());

function toolFailure(spec: ToolSpec, tools: string[]): string[] {
  if ("exactly" in spec) {
    return sameSet(tools, spec.exactly) ? [] : [`tools: called ${tools.join(", ") || "none"}, expected exactly ${spec.exactly.join(", ") || "none"}`];
  }
  if ("anyOf" in spec) {
    return spec.anyOf.some((t) => tools.includes(t)) ? [] : [`tools: called ${tools.join(", ") || "none"}, expected one of ${spec.anyOf.join(", ")}`];
  }
  const missing = spec.includes.filter((t) => !tools.includes(t));
  return missing.length ? [`tools: called ${tools.join(", ") || "none"}, missing ${missing.join(", ")}`] : [];
}

/** What a turn got wrong against what its spec expects: the tools, the page, the help center, the promise. */
export function judge(spec: TurnSpec, observation: Observation): string[] {
  const failures = toolFailure(spec.tools, observation.tools);
  if (spec.page === "unchanged" && observation.page) failures.push("page: changed, expected unchanged");
  if (spec.page === "changed" && !observation.page) failures.push("page: unchanged, expected a new search");
  if (spec.check) failures.push(...spec.check(observation).map((f) => `check: ${f}`));
  if (spec.faq) {
    const faq = FAQ_CASES.find((c) => c.id === spec.faq);
    if (!faq) throw new Error(`no FAQ case ${spec.faq}`);
    failures.push(...checkFaqAnswer(faq, observation.answer).map((f) => `faq: ${f}`));
  }
  if (observation.handOver && promisesHandOver(observation.answer)) failures.push("promise: the answer promises the connection");
  return failures;
}

/** Plays one case once, as the browser would: the page, the history, the tool results fed back. */
export async function playCase(c: EvalCase, run: number, variant: Variant): Promise<Outcome[]> {
  let page = pageStateFor(c.opening);
  let entries: ChatEntry[] = [{ kind: "assistant", text: firstMessage(page) }];
  const outcomes: Outcome[] = [];

  for (const [index, spec] of c.turns.entries()) {
    const history = addUserMessage(entries, spec.say, page);
    const base = { case: c.id, run, turn: index + 1, say: spec.say, review: spec.review ?? false };
    const started = Date.now();
    try {
      const { usage, ...response } = await runTurn({
        model: getModel(),
        entries: history,
        onScreen: page.results.map((r) => r.tripId),
        instructions: variant.instructions,
        reasoning: variant.reasoning,
      });
      const observation = observe(response, usage, Date.now() - started);
      outcomes.push({
        ...base,
        observation,
        failures: judge(spec, observation),
        ungrounded: ungroundedFacts(observation.answer, groundingSources(history, response)),
        stale: staleTripsNamed(observation.answer, page, response.page ?? page, spec.say),
      });
      entries = [...history, ...response.entries];
      if (response.page) page = response.page;
    } catch (error) {
      // What the user would have read; the rest of the case depends on this turn, so it stops here
      const failure = describeFailure(error, { aborted: false });
      outcomes.push({
        ...base,
        error: { status: failure.status, message: failure.message, name: error instanceof Error ? (error.name === "Error" ? error.constructor.name : error.name) : "unknown" },
        failures: [`error: ${failure.status} ${failure.message}`],
        ungrounded: { prices: [], dates: [] },
        stale: [],
      });
      break;
    }
  }
  return outcomes;
}

export interface Summary {
  variant: string;
  turns: number;
  errors: { total: number; byStatus: Record<string, number> };
  /** Turns that passed everything / had each kind of failure. */
  clean: number;
  failuresByKind: Record<string, number>;
  /** Turns whose answer states a price or a day that this turn's sources don't. */
  ungroundedTurns: number;
  /** Turns whose answer names a trip the search took off the page. */
  staleTurns: number;
  promisesChecked: number;
  promises: number;
  tokens: TurnUsage;
  cost: number;
  latency: { meanMs: number; maxMs: number };
}

export function summarize(variant: string, outcomes: Outcome[]): Summary {
  const answered = outcomes.filter((o) => o.observation);
  const byStatus: Record<string, number> = {};
  for (const o of outcomes.filter((x) => x.error)) byStatus[o.error!.status] = (byStatus[o.error!.status] ?? 0) + 1;
  const failuresByKind: Record<string, number> = {};
  for (const o of outcomes) for (const f of new Set(o.failures.map((line) => line.split(":")[0]))) failuresByKind[f] = (failuresByKind[f] ?? 0) + 1;
  const tokens = answered.reduce(
    (sum, o) => ({
      inputTokens: sum.inputTokens + o.observation!.usage.inputTokens,
      outputTokens: sum.outputTokens + o.observation!.usage.outputTokens,
      reasoningTokens: sum.reasoningTokens + o.observation!.usage.reasoningTokens,
    }),
    { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
  );
  const times = answered.map((o) => o.observation!.ms);
  return {
    variant,
    turns: outcomes.length,
    errors: { total: outcomes.filter((o) => o.error).length, byStatus },
    clean: outcomes.filter((o) => o.failures.length === 0 && o.ungrounded.prices.length === 0 && o.ungrounded.dates.length === 0 && o.stale.length === 0).length,
    failuresByKind,
    ungroundedTurns: outcomes.filter((o) => o.ungrounded.prices.length > 0 || o.ungrounded.dates.length > 0).length,
    staleTurns: outcomes.filter((o) => o.stale.length > 0).length,
    promisesChecked: answered.filter((o) => o.observation!.handOver).length,
    promises: outcomes.filter((o) => o.failures.some((f) => f.startsWith("promise"))).length,
    tokens,
    cost: costOf(tokens),
    latency: { meanMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0, maxMs: times.length ? Math.max(...times) : 0 },
  };
}

/** Runs every case `variant.runs` times with a few at once, and returns the outcomes in order. */
export async function runAll(variant: Variant, concurrency = 3, cases: EvalCase[] = CASES): Promise<Outcome[]> {
  const tasks = cases.flatMap((c) => Array.from({ length: variant.runs }, (_, i) => ({ c, run: i + 1 })));
  const results: Outcome[][] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next++;
        results[index] = await playCase(tasks[index].c, tasks[index].run, variant);
      }
    }),
  );
  return results.flat();
}

const line = (o: Outcome) => `${o.case}#${o.run}.${o.turn}`;
const oneLine = (text: string) => text.replace(/\n+/g, " | ");

/** The summary and what to read, as text: printed, and written next to the results. */
export function report(summary: Summary, outcomes: Outcome[], runs: number): string {
  const out: string[] = [`# ${summary.variant}: ${summary.turns} turns, ${runs} runs of each case`, ""];
  out.push(`- clean turns (every check passed): **${summary.clean} of ${summary.turns}**`);
  out.push(`- errors: ${summary.errors.total} ${JSON.stringify(summary.errors.byStatus)}`);
  out.push(`- failures by kind (turns): ${JSON.stringify(summary.failuresByKind)}`);
  out.push(`- answers stating a price or a day no source states: ${summary.ungroundedTurns}`);
  out.push(`- answers naming a trip the search took off the page: ${summary.staleTurns}`);
  out.push(`- promises of a connection: ${summary.promises} of ${summary.promisesChecked} hand-over turns`);
  out.push(`- tokens in/out/reasoning: ${summary.tokens.inputTokens}/${summary.tokens.outputTokens}/${summary.tokens.reasoningTokens}`);
  out.push(`- estimated cost: $${summary.cost.toFixed(4)}; latency mean ${summary.latency.meanMs} ms, max ${summary.latency.maxMs} ms`, "");
  out.push("## Turns with a failure", "");
  for (const o of outcomes.filter((x) => x.failures.length > 0)) out.push(`- ${line(o)} "${o.say}": ${o.failures.join(" | ")}`);
  out.push("", "## Answers stating a price or a day no source states", "");
  for (const o of outcomes.filter((x) => x.ungrounded.prices.length || x.ungrounded.dates.length)) {
    out.push(`- ${line(o)} prices ${JSON.stringify(o.ungrounded.prices)} days ${JSON.stringify(o.ungrounded.dates)}: ${oneLine(o.observation?.answer ?? "")}`);
  }
  out.push("", "## Answers naming a trip that left the page", "");
  for (const o of outcomes.filter((x) => x.stale.length)) out.push(`- ${line(o)} ${JSON.stringify(o.stale)}: ${oneLine(o.observation?.answer ?? "")}`);
  out.push("", "## Answers to read (the kinds of error with no check)", "");
  for (const o of outcomes.filter((x) => x.review && x.observation)) out.push(`- ${line(o)} "${o.say}": ${oneLine(o.observation!.answer)}`);
  return out.join("\n") + "\n";
}
