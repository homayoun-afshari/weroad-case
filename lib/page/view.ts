import { bookableDepartures } from "@/lib/search/catalog";
import { outsideBy } from "@/lib/search/departures";
import { search } from "@/lib/search/search";
import type { SearchRequest, SearchResult, SearchState } from "@/lib/search/types";
import type { PageState, ResultView } from "./types";

/** Keeps what the results list shows; the page never needs the itinerary or the descriptions. */
export function toView(result: SearchResult, original?: SearchState): ResultView {
  const { trip, fromPrice, state } = result;
  const view: ResultView = {
    tripId: trip.id,
    title: trip.title,
    destination: trip.destination,
    days: trip.numberOfDays,
    url: trip.url,
    fromPrice,
    state,
  };
  // Found with the dates loosened: the tag shows which departure is nearest to the dates asked
  if (original?.dates && !state.dates) {
    const window = original.dates;
    const [nearest] = bookableDepartures(trip).sort((a, b) => outsideBy(a, window) - outsideBy(b, window));
    if (nearest) view.nearestDeparture = { from: nearest.startingDate, to: nearest.endingDate };
  }
  return view;
}

/** Runs the search function and returns the page state for it. The page and the agent both use this. */
export function pageStateFor(request: SearchRequest): PageState {
  const { originalState, results } = search(request);
  return { request, originalState, results: results.map((r) => toView(r, originalState)) };
}
