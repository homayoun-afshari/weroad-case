export type SalesStatus =
  | "PLANNED"
  | "ALMOST_CONFIRMED"
  | "CONFIRMED"
  | "ALMOST_FULL"
  | "WAITING_LIST"
  | "SOLD_OUT"
  | "NOT_AVAILABLE";

export type PhysicalRating = "LOW" | "MEDIUM" | "HIGH";

export type AgeBand = "18-25" | "25-35" | "25-49";

export interface Departure {
  id: string;
  startingDate: string; // ISO date, YYYY-MM-DD
  endingDate: string;
  priceEur: number;
  basePriceEur: number | null;
  salesStatus: SalesStatus;
  isConfirmed: boolean;
  maxPax: number;
  seatsLeft: number;
  paxBooked: number;
  privateRoomBookable: boolean;
  isWomenOnly: boolean;
  ageBand: AgeBand;
}

export interface ItineraryDay {
  day: number;
  title: string;
  nights: string | null;
  highlights: string[];
}

export interface Trip {
  id: number;
  slug: string;
  url: string;
  title: string;
  shortDescription: string;
  description: string;
  destination: string;
  destinationLabel: string;
  continent: string | null;
  numberOfDays: number;
  startingPlace: string;
  endingPlace: string;
  travelTypes: string[];
  moods: Record<"party" | "relax" | "nature" | "culture" | "history", number>;
  physicalRating: PhysicalRating;
  rating?: { value: number; count: number };
  itinerary: ItineraryDay[];
  tours: Departure[];
}

export interface Faq {
  id: number;
  scope: "general" | "destination";
  destination: string | null;
  title: string;
  body: string;
  url: string;
}

/** The values the search filters hold. */
export interface SearchFilters {
  /** Departures lying fully inside the window (inclusive ISO dates). */
  dates?: { from: string; to: string };
  maxPrice?: number;
  days?: { min?: number; max?: number };
  ageBand?: AgeBand;
  physicalRating?: PhysicalRating;
  privateRoom?: boolean;
}

/** The content of the search bar and the search filters, as the user or the agent sends it. */
export interface SearchRequest extends SearchFilters {
  text: string;
}

/** A search request read by the translator: the values it recognized next to the filters, and the text left over. */
export interface SearchState extends SearchFilters {
  /** Words left over after the translator took out the values it recognized. */
  text: string;
  /** A trip matches if its destination is any of them. Empty means any. */
  destinations: string[];
  /** A trip must have all of them. */
  tripTypes: string[];
}

/** One trip found by the mock API, with the bookable departures that matched the departure filters. */
export interface RawSearchResult {
  trip: Trip;
  departures: Departure[];
  /** The cheapest of those departures. */
  fromPrice: number;
}

/** One trip returned by a search, with the search state that found it. */
export interface SearchResult extends RawSearchResult {
  state: SearchState;
}

/** What the search function returns: the state read from the request, and the results. */
export interface SearchOutput {
  originalState: SearchState;
  results: SearchResult[];
}
