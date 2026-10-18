import { destinations, tripTypes } from "./catalog";
import { words } from "./text";
import type { SearchRequest, SearchState } from "./types";

/** Words that carry no search meaning ("trips to Japan in spring"). */
const FILLER = new Set(["a", "an", "and", "at", "for", "from", "in", "of", "on", "or", "the", "to", "trip", "trips", "with"]);

const NUMBER = String.raw`(\d+(?:[.,]\d{3})*(?:\.\d+)?)\s*(k\b)?`;
const CURRENCY = String.raw`(?:€|eur\b|euros?\b)?`;
const PRICE_PHRASE = new RegExp(
  String.raw`\b(?:under|below|less than|max|maximum|up to|at most|no more than|within)\s*${CURRENCY}\s*${NUMBER}\s*${CURRENCY}`,
  "i",
);

/** "under 2000", "max 2,000 euros", "up to 2k" → 2000. Returns the text without the phrase. */
function takePrice(text: string): { text: string; maxPrice?: number } {
  const match = PRICE_PHRASE.exec(text);
  if (!match) return { text };
  const amount = Number(match[1].replace(/[.,](?=\d{3}\b)/g, "")) * (match[2] ? 1000 : 1);
  return { text: text.slice(0, match.index) + " " + text.slice(match.index + match[0].length), maxPrice: amount };
}

/** Finds each phrase as consecutive words and marks them as used, longest phrases first. */
function takePhrases(tokens: string[], used: boolean[], phrases: string[]): string[] {
  const found: string[] = [];
  const byLength = [...phrases].sort((a, b) => words(b).length - words(a).length);
  for (const phrase of byLength) {
    const target = words(phrase);
    for (let i = 0; i + target.length <= tokens.length; i++) {
      const fits = target.every((word, k) => tokens[i + k] === word && !used[i + k]);
      if (!fits) continue;
      target.forEach((_, k) => (used[i + k] = true));
      found.push(phrase);
      break;
    }
  }
  return found;
}

/**
 * Plays the role of WeRoad's coming classifier ("Smart filters"): reads the search bar's text
 * for catalog destinations, trip types and a price phrase, and leaves the rest as text.
 * A value set in a filter wins over the same value read from the text.
 */
export function translate(request: SearchRequest): SearchState {
  const { text: textWithoutPrice, maxPrice } = takePrice(request.text);
  const tokens = words(textWithoutPrice);
  const used = tokens.map(() => false);
  const foundDestinations = takePhrases(tokens, used, destinations);
  const foundTypes = takePhrases(tokens, used, tripTypes);
  const left = tokens.filter((word, i) => !used[i] && !FILLER.has(word));
  return {
    ...request,
    text: left.join(" "),
    destinations: foundDestinations,
    tripTypes: foundTypes,
    maxPrice: request.maxPrice ?? maxPrice,
  };
}
