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
