import { loosenedKeys, type LoosenKey } from "@/lib/search/loosening";
import type { SearchState } from "@/lib/search/types";
import { describeDays, formatPrice } from "./format";
import type { ResultView } from "./types";

function tag(key: LoosenKey, original: SearchState, result: ResultView): string {
  switch (key) {
    case "maxPrice":
      return `${formatPrice(result.fromPrice)} · above your ${formatPrice(original.maxPrice!)}`;
    case "dates":
      return "no departure inside your dates";
    case "days":
      return `${result.days} days · outside your ${describeDays(original.days!)}`;
    case "ageBand":
      return `age band not applied (you asked ${original.ageBand})`;
    case "physicalRating":
      return `physical effort not applied (you asked ${original.physicalRating!.toLowerCase()})`;
    case "privateRoom":
      return "private room not applied";
    case "text":
      return `words not applied: "${original.text}"`;
    case "tripTypes":
      return `trip type not applied: ${original.tripTypes.join(", ")}`;
    case "destinations":
      return `other destination (you asked for ${original.destinations.join(", ")})`;
  }
}

/**
 * The tags of a search result, computed from how the search state that found it differs from the
 * original: one for each value that was loosened, in the fixed order. A result found for the search
 * itself has none. The page and the chat both read the state, so they say the same thing.
 */
export function resultTags(original: SearchState, result: ResultView): string[] {
  return loosenedKeys(original, result.state).map((key) => tag(key, original, result));
}
