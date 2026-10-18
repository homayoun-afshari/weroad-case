import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { report, runAll, summarize } from "./engine";
import { VARIANTS } from "./variants";

/**
 * The live eval: `npm run eval` plays every case against the real model, applies the checks, prints
 * the summary and writes `evals/results/<variant>.json`. It costs money (a few cents a run).
 *
 *   EVAL_VARIANT   baseline (default), low-reasoning or rules: see variants.ts
 *   EVAL_RUNS      how many times each case is played (default 2)
 */

const name = process.env.EVAL_VARIANT ?? "baseline";
const variant = VARIANTS[name];

describe("live eval", () => {
  it(`plays every case: ${name}`, async () => {
    expect(variant, `unknown variant ${name}`).toBeDefined();
    const outcomes = await runAll(variant);
    const summary = summarize(variant.name, outcomes);

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/${variant.name}.json`, JSON.stringify({ summary, outcomes }, null, 2) + "\n");

    const text = report(summary, outcomes, variant.runs);
    writeFileSync(`evals/results/${variant.name}.md`, text);
    console.log(text);
  }, 1_800_000);
});
