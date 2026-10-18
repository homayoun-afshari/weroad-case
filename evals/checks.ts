import { pageStateBlock } from "@/lib/chat/blocks";
import type { ChatEntry, TurnResponse } from "@/lib/chat/types";

/**
 * Checks on what the assistant wrote, in code: no model judges them. The tests use them on answers
 * recorded from live runs, and the live eval (`npm run eval`) uses them on fresh ones.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = String.raw`(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?`;
const ORDINAL = String.raw`(?:st|nd|rd|th)?`;

const monthNumber = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1;
const pad = (n: number) => String(n).padStart(2, "0");

/** The numbers in a text, with or without thousands separators: "€1,759", "1759", `"priceEur":1599`. */
export function numbersIn(text: string): Set<number> {
  const found = text.match(/\d{1,3}(?:,\d{3})+|\d+/g) ?? [];
  return new Set(found.map((n) => Number(n.replace(/,/g, ""))));
}

/** The prices an answer states: "€1,759", "€ 2539", "2,000 euros". */
export function amountsIn(text: string): number[] {
  const amounts = [...text.matchAll(/€\s?(\d{1,3}(?:[.,]\d{3})+|\d+)|(\d{1,3}(?:[.,]\d{3})+|\d+)\s?(?:euros?|eur)\b/gi)];
  return amounts.map((m) => Number((m[1] ?? m[2]).replace(/[.,]/g, "")));
}

/** The days of a year a text names, as "MM-DD": ISO dates, "19-24 October", "31 October", "October 31". */
export function datesIn(text: string): Set<string> {
  const days = new Set<string>();
  const add = (month: string, day: string) => {
    const m = monthNumber(month);
    if (m > 0 && Number(day) >= 1 && Number(day) <= 31) days.add(`${pad(m)}-${pad(Number(day))}`);
  };
  for (const [, , mm, dd] of text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) days.add(`${mm}-${dd}`);
  // a range inside one month: "19-24 October", "20–27 October", "1 to 8 December"
  for (const m of text.matchAll(new RegExp(String.raw`(\d{1,2})${ORDINAL}\s*(?:–|—|-|to|and)\s*(\d{1,2})${ORDINAL}\s+${MONTH}`, "gi"))) {
    add(m[3], m[1]);
    add(m[3], m[2]);
  }
  for (const m of text.matchAll(new RegExp(String.raw`(\d{1,2})${ORDINAL}\s+${MONTH}`, "gi"))) add(m[2], m[1]);
  for (const m of text.matchAll(new RegExp(String.raw`\b${MONTH}\s+(\d{1,2})${ORDINAL}\b`, "gi"))) add(m[1], m[2]);
  return days;
}

const label = (day: string) => {
  const [month, date] = day.split("-").map(Number);
  const name = MONTHS[month - 1];
  return `${date} ${name[0].toUpperCase()}${name.slice(1)}`;
};

export interface Ungrounded {
  /** Prices in the answer that none of the sources states. */
  prices: number[];
  /** Days in the answer that none of the sources names, like "31 October". */
  dates: string[];
}

/**
 * The strict check on prices and dates: every price and every day in the answer must be stated by
 * the sources. A derived figure (a difference, a total) counts as not stated, and is reviewed by hand.
 * See `groundingSources` for what the sources are.
 */
export function ungroundedFacts(answer: string, sources: string[]): Ungrounded {
  const allowedNumbers = new Set(sources.flatMap((s) => [...numbersIn(s)]));
  const allowedDays = new Set(sources.flatMap((s) => [...datesIn(s)]));
  return {
    prices: [...new Set(amountsIn(answer))].filter((n) => !allowedNumbers.has(n)),
    dates: [...datesIn(answer)].filter((d) => !allowedDays.has(d)).map(label),
  };
}

/** The `<page_state>` block of a user entry's page context. */
const pageStateOf = (entry: ChatEntry | undefined) =>
  entry?.kind === "user" ? (entry.blocks.match(/<page_state>[\s\S]*?<\/page_state>/)?.[0] ?? "") : "";

/**
 * What an answer may take a price or a date from (the strict rule): the page as it is **after** the
 * turn (the new page state when the agent searched, else the one the user message carried), what the
 * tools returned **this turn**, and the user's own words. Not the page state of an earlier turn.
 */
export function groundingSources(history: ChatEntry[], response: TurnResponse): string[] {
  const last = history[history.length - 1];
  const toolResults = response.entries
    .filter((e) => e.kind === "tools")
    .flatMap((e) => e.messages)
    .filter((m) => m.role === "tool")
    .map((m) => JSON.stringify(m.content));
  return [
    last?.kind === "user" ? last.text : "",
    response.page ? pageStateBlock(response.page) : pageStateOf(last),
    ...toolResults,
  ];
}

/**
 * A sentence that promises the hand-over before the user has chosen: "I'll connect you with a human
 * agent". "Yes" only ends the chat, and nothing happens until the user answers, so the assistant may
 * offer a person but not promise one.
 */
export function promisesHandOver(answer: string): boolean {
  return [
    /\bI(?:'ll| will)\s+(?:connect|pass|transfer|put|hand|route)\b/i,
    /\bI(?:'m| am)\s+(?:connecting|passing|transferring|handing|putting)\b/i,
    /\blet me\s+(?:connect|pass|transfer|do that|hand|put)\b/i,
  ].some((pattern) => pattern.test(answer));
}
