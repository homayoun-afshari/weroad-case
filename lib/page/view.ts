import { search } from "@/lib/search/search";
import type { SearchRequest, SearchResult } from "@/lib/search/types";
import type { PageState, ResultView } from "./types";

/** Keeps what the results list shows; the page never needs the itinerary or the descriptions. */
export function toView(result: SearchResult): ResultView {
  const { trip, fromPrice, state } = result;
  return {
    tripId: trip.id,
    title: trip.title,
    destination: trip.destination,
    days: trip.numberOfDays,
    url: trip.url,
    fromPrice,
    state,
  };
}

/** Runs the search function and returns the page state for it. The page and the agent both use this. */
export function pageStateFor(request: SearchRequest): PageState {
  const { originalState, results } = search(request);
  return { request, originalState, results: results.map(toView) };
}
