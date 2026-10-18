import { formatPrice } from "@/lib/page/format";
import { isSuggested } from "@/lib/page/suggested";
import { loosenedKeys, type LoosenKey } from "@/lib/search/loosening";
import type { PageState } from "@/lib/page/types";
import type { SearchRequest, SearchState } from "@/lib/search/types";
import type { PageEvent } from "./types";

/** How many results the page state lists; the rest are counted, so a long list doesn't weigh on every turn. */
const MAX_LISTED = 10;

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

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

/** What was loosened, with the value that was asked: `max price €2,000`, `destinations Argentina`, `the words "hiking brazil"`. */
function describeLoosened(original: SearchState, keys: LoosenKey[]): string {
  const parts = keys.map((key) => {
    if (key === "text") return `the words "${original.text}"`;
    if (key === "tripTypes") return `trip types ${original.tripTypes.join(", ")}`;
    if (key === "destinations") return `destinations ${original.destinations.join(", ")}`;
    return describeFilters({ text: "", [key]: original[key] })[0];
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

export function describeEvent(event: PageEvent): string {
  if (event.kind === "search") {
    const found = event.suggested ? `no exact matches, ${plural(event.count, "closest option")}` : plural(event.count, "result");
    return `user searched ${describeRequest(event.request)} (${found})`;
  }
  if (event.kind === "controls") {
    return event.draft
      ? `user changed the controls but has not searched yet: ${describeRequest(event.draft)}`
      : "user put the controls back to the page's search";
  }
  const whose = event.reversed === "assistant" ? "the assistant's change" : "their own change";
  return `user undid ${whose} (${describeRequest(event.undone)}) and is back to ${describeRequest(event.restored)}`;
}

/** What the page shows right now: the search, and the trips on screen. */
export function pageStateBlock(page: PageState): string {
  const { request, results } = page;
  const search = describeRequest(request) + (request.dates ? "" : " · dates: none");
  const listed = results.slice(0, MAX_LISTED).map((r) => {
    const loosened = loosenedKeys(page.originalState, r.state);
    const what = loosened.length ? `, loosened: ${describeLoosened(page.originalState, loosened)}` : "";
    return `#${r.tripId} ${r.destination} (${plural(r.days, "day")}, from ${formatPrice(r.fromPrice)}${what})`;
  });
  const shown = results.length > MAX_LISTED ? `, first ${MAX_LISTED} shown` : "";
  const list = listed.length ? `results (${results.length}${shown}): ${listed.join(", ")}` : "results (0): none";
  // Nothing matched: the page shows the nearest options instead, and the agent must not call them matches
  const notice = isSuggested(page) ? "no exact matches: the page shows the closest options instead, each with what was loosened\n" : "";
  return `<page_state>\nsearch: ${search}\n${notice}${list}\n</page_state>`;
}

/** The page context placed before a user message: what happened on the page since the last one, then where it stands. */
export function pageBlocks(events: PageEvent[], page: PageState): string {
  const state = pageStateBlock(page);
  if (events.length === 0) return state;
  return `<page_events>\n${events.map(describeEvent).join("\n")}\n</page_events>\n${state}`;
}
