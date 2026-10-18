import type { SearchState } from "./types";

/** The values of a search state that can be loosened, in the fixed order they are loosened in. */
export type LoosenKey =
  | "dates"
  | "maxPrice"
  | "days"
  | "ageBand"
  | "physicalRating"
  | "privateRoom"
  | "text"
  | "tripTypes"
  | "destinations";

/**
 * Filters come before the text, and the text is loosened last: first the words nobody recognized,
 * then the trip types, then the destinations.
 */
export const LOOSEN_ORDER: LoosenKey[] = [
  "dates",
  "maxPrice",
  "days",
  "ageBand",
  "physicalRating",
  "privateRoom",
  "text",
  "tripTypes",
  "destinations",
];

export function isSet(state: SearchState, key: LoosenKey): boolean {
  switch (key) {
    case "dates":
      return state.dates !== undefined;
    case "maxPrice":
      return state.maxPrice !== undefined;
    case "days":
      return state.days !== undefined && (state.days.min !== undefined || state.days.max !== undefined);
    case "ageBand":
      return state.ageBand !== undefined;
    case "physicalRating":
      return state.physicalRating !== undefined;
    case "privateRoom":
      return state.privateRoom === true;
    case "text":
      return state.text.trim() !== "";
    case "tripTypes":
      return state.tripTypes.length > 0;
    case "destinations":
      return state.destinations.length > 0;
  }
}

/** A copy of the state without one value. */
export function drop(state: SearchState, key: LoosenKey): SearchState {
  const copy = { ...state };
  if (key === "text") copy.text = "";
  else if (key === "tripTypes") copy.tripTypes = [];
  else if (key === "destinations") copy.destinations = [];
  else delete copy[key];
  return copy;
}

/** The values the original state had that this state no longer has. */
export function loosenedKeys(original: SearchState, state: SearchState): LoosenKey[] {
  return LOOSEN_ORDER.filter((key) => isSet(original, key) && !isSet(state, key));
}

const LABELS: Record<LoosenKey, string> = {
  dates: "dates",
  maxPrice: "max price",
  days: "duration",
  ageBand: "age band",
  physicalRating: "physical effort",
  privateRoom: "private room",
  text: "search words",
  tripTypes: "trip types",
  destinations: "destinations",
};

/** `max price`, `dates and max price`, `dates, max price and duration`. */
export function describeLoosened(keys: LoosenKey[]): string {
  const labels = keys.map((key) => LABELS[key]);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : (labels[0] ?? "");
}
