import { searchTrips } from "./mockApi";
import { translate } from "./translator";
import type { SearchOutput, SearchRequest } from "./types";

/**
 * The search function: the one place a search happens. The search button (through an API route)
 * and the agent's search_trips tool both call it, so the page and the chat never disagree.
 */
export function search(request: SearchRequest): SearchOutput {
  const originalState = translate(request);
  const results = searchTrips(originalState).map((raw) => ({ ...raw, state: originalState }));
  return { originalState, results };
}
