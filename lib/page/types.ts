import type { SearchRequest, SearchState } from "@/lib/search/types";

/** One search result as the page shows it: no itinerary or description, only what the list needs. */
export interface ResultView {
  tripId: number;
  title: string;
  destination: string;
  days: number;
  url: string;
  /** The cheapest bookable departure that matches the search state that found the trip. */
  fromPrice: number;
  /** The search state that found this trip. */
  state: SearchState;
}

/** The current search request, its original search state and the search results. */
export interface PageState {
  request: SearchRequest;
  originalState: SearchState;
  results: ResultView[];
}

/** Who made a change to the page. */
export type Source = "user" | "assistant";

export interface HistoryEntry {
  state: PageState;
  source: Source;
}

/** The past page states, oldest first; the last entry is the current page state. */
export interface PageHistory {
  entries: HistoryEntry[];
}
