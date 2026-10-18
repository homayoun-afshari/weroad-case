import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import type { Variant } from "./engine";

/**
 * The two rules the eval measures before they go into the prompt: what the assistant may quote, and
 * the tone. They are added only if the measured rate improves without changing the tools chosen.
 */
const RULES = `
- Mention only trips that the page shows now, after your search. Quote prices and dates only from the current page state or this turn's tool results. Don't name or price a trip the page no longer shows, even if it was on the page before.
- Describe what changed as facts, not recommendations: say what the page shows and why, and leave the choice to the user.`;

const runs = Number(process.env.EVAL_RUNS ?? 2);

/** Chosen with `EVAL_VARIANT`: the prompt and the model setting the run uses. */
export const VARIANTS: Record<string, Variant> = {
  baseline: { name: "baseline", runs },
  "low-reasoning": { name: "low-reasoning", reasoning: "low", runs },
  rules: { name: "rules", instructions: SYSTEM_PROMPT + RULES, runs },
};
