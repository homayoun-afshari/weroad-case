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

/** What is being searched: the words and the filters, as the mock API reads them. */
export interface SearchState {
  /** Words left over after the translator took out the values it recognized. */
  text: string;
  /** A trip matches if its destination is any of them. Empty means any. */
  destinations: string[];
  /** A trip must have all of them. */
  tripTypes: string[];
  /** Departures lying fully inside the window (inclusive ISO dates). */
  dates?: { from: string; to: string };
  maxPrice?: number;
  days?: { min?: number; max?: number };
  ageBand?: AgeBand;
  physicalRating?: PhysicalRating;
  privateRoom?: boolean;
}

/** One trip found by the mock API, with the bookable departures that matched the departure filters. */
export interface RawSearchResult {
  trip: Trip;
  departures: Departure[];
  /** The cheapest of those departures. */
  fromPrice: number;
}
