import { searchTrips } from "./mockApi";
import { suggest } from "./suggester";
import { translate } from "./translator";
import type { SearchOutput, SearchRequest } from "./types";

/**
 * The search function: the one place a search happens. The search button (through an API route)
 * and the agent's search_trips tool both call it, so the page and the chat never disagree.
 */
export function search(request: SearchRequest): SearchOutput {
  const originalState = translate(request);
  const raw = searchTrips(originalState);
  // Exact matches stand as they are; only when there are none do the nearest options replace them
  const results = raw.length > 0 ? raw.map((result) => ({ ...result, state: originalState })) : suggest(originalState);
  return { originalState, results };
}
