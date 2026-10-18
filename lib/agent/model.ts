import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/** The cheapest capable model; `ANTHROPIC_MODEL` in `.env.local` overrides it. */
const DEFAULT_MODEL = "claude-haiku-5-5";

export function getModel(): LanguageModel {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill it in.");
  }
  return createAnthropic()(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL);
}
