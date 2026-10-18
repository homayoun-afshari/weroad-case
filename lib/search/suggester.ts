import { outsideBy } from "./departures";
import { drop, isSet, LOOSEN_ORDER, type LoosenKey } from "./loosening";
import { searchTrips } from "./mockApi";
import type { RawSearchResult, SearchResult, SearchState } from "./types";

/** The nearest options, not every trip that was found. */
export const MAX_SUGGESTIONS = 10;

/** How far a result is from what was asked, for the value that was loosened. Only some values can be measured. */
function distance(result: RawSearchResult, original: SearchState, key: LoosenKey): number {
  switch (key) {
    case "maxPrice":
      return result.fromPrice - original.maxPrice!;
    case "dates":
      return Math.min(...result.departures.map((d) => outsideBy(d, original.dates!)));
    case "days": {
      const { min, max } = original.days!;
      const days = result.trip.numberOfDays;
      return Math.max(0, (min ?? days) - days, days - (max ?? days));
    }
    default:
      return 0;
  }
}

/**
 * What to show when a search finds nothing: the nearest options, never an empty page. It runs only
 * when the raw results are empty.
 *
 * It loosens the state in a fixed order (dates, price, duration, the other filters, then the text:
 * the words, the trip types, the destinations). First **one value at a time**: each value dropped
 * alone gives its own results, each with the state that found it. If every single drop is still
 * empty, the values are dropped together, in the same order, until something is found; with all of
 * them dropped, every bookable trip is. So the calls are bounded: at most one per value, then one
 * per prefix of the values.
 *
 * The results are ordered by how little was loosened: the value loosened first in the fixed order
 * first, and inside it the nearest to what was asked (price over, days outside the dates or the
 * duration). A trip found by two loosenings is listed once, by the first. At most MAX_SUGGESTIONS
 * are returned.
 */
export function suggest(original: SearchState): SearchResult[] {
  const values = LOOSEN_ORDER.filter((key) => isSet(original, key));

  const found = values.flatMap((key) => {
    const state = drop(original, key);
    return searchTrips(state)
      .map((result, index) => ({ result, index, state, gap: distance(result, original, key) }))
      .sort((a, b) => a.gap - b.gap || a.index - b.index);
  });
  if (found.length > 0) {
    const seen = new Set<number>();
    const suggestions: SearchResult[] = [];
    for (const { result, state } of found) {
      if (suggestions.length === MAX_SUGGESTIONS) break;
      if (seen.has(result.trip.id)) continue;
      seen.add(result.trip.id);
      suggestions.push({ ...result, state });
    }
    return suggestions;
  }

  for (let count = 2; count <= values.length; count++) {
    const state = values.slice(0, count).reduce(drop, original);
    const results = searchTrips(state);
    if (results.length > 0) return results.slice(0, MAX_SUGGESTIONS).map((result) => ({ ...result, state }));
  }
  return [];
}
