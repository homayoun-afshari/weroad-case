import { formatPrice } from "@/lib/page/format";
import type { PageState } from "@/lib/page/types";
import type { SearchRequest } from "@/lib/search/types";
import type { PageEvent } from "./types";

/** How many results the page state lists; the rest are counted, so a long list doesn't weigh on every turn. */
const MAX_LISTED = 10;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function describeDays({ min, max }: { min?: number; max?: number }): string {
  if (min !== undefined && max !== undefined) return `${min} to ${max} days`;
  return min !== undefined ? `at least ${plural(min, "day")}` : `at most ${plural(max!, "day")}`;
}

/** The filters that are set, in words: `max price €2,000`, `dates: 2026-12-01 to 2026-12-08`. */
export function describeFilters(request: SearchRequest): string[] {
  const parts: string[] = [];
  if (request.maxPrice !== undefined) parts.push(`max price ${formatPrice(request.maxPrice)}`);
  if (request.dates) parts.push(`dates: ${request.dates.from} to ${request.dates.to}`);
  if (request.days) parts.push(describeDays(request.days));
  if (request.ageBand) parts.push(`age band ${request.ageBand}`);
  if (request.physicalRating) parts.push(`physical effort ${request.physicalRating.toLowerCase()}`);
  if (request.privateRoom) parts.push("private room");
  return parts;
}

/** The search request in words: `"northern lights" · max price €2,000`. */
export function describeRequest(request: SearchRequest): string {
  const text = request.text ? `"${request.text}"` : "no search text";
  return [text, ...describeFilters(request)].join(" · ");
}

export function describeEvent(event: PageEvent): string {
  if (event.kind === "search") {
    return `user searched ${describeRequest(event.request)} (${plural(event.count, "result")})`;
  }
  const whose = event.reversed === "assistant" ? "the assistant's change" : "their own change";
  return `user undid ${whose} (${describeRequest(event.undone)}) and is back to ${describeRequest(event.restored)}`;
}

/** What the page shows right now: the search, and the trips on screen. */
export function pageStateBlock(page: PageState): string {
  const { request, results } = page;
  const search = describeRequest(request) + (request.dates ? "" : " · dates: none");
  const listed = results
    .slice(0, MAX_LISTED)
    .map((r) => `#${r.tripId} ${r.destination} (${plural(r.days, "day")}, from ${formatPrice(r.fromPrice)})`);
  const shown = results.length > MAX_LISTED ? `, first ${MAX_LISTED} shown` : "";
  const list = listed.length ? `results (${results.length}${shown}): ${listed.join(", ")}` : "results (0): none";
  return `<page_state>\nsearch: ${search}\n${list}\n</page_state>`;
}

/** The page context placed before a user message: what happened on the page since the last one, then where it stands. */
export function pageBlocks(events: PageEvent[], page: PageState): string {
  const state = pageStateBlock(page);
  if (events.length === 0) return state;
  return `<page_events>\n${events.map(describeEvent).join("\n")}\n</page_events>\n${state}`;
}
