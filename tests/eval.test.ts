import { describe, expect, it } from "vitest";
import { getFaq } from "@/lib/search/faq";
import { getDepartures } from "@/lib/search/departures";
import { isBookable, trips } from "@/lib/search/catalog";
import { loosenedKeys } from "@/lib/search/loosening";
import { search } from "@/lib/search/search";
import { translate } from "@/lib/search/translator";
import type { SearchRequest } from "@/lib/search/types";

/**
 * The cases the code decides: the brief's own examples, which the data was built around. No model
 * is involved: they check the search function, the departures and the FAQ, and each one is checked
 * against the raw data by brute force, so a bug in the search can't hide behind itself. What the
 * model does with them (which tool, what it says) is the live eval, `npm run eval`.
 */

const run = (request: SearchRequest) => {
  const { originalState, results } = search(request);
  return { originalState, results, ids: results.map((r) => r.trip.id), exact: results.every((r) => loosenedKeys(originalState, r.state).length === 0) };
};

/** The trips that have a bookable departure fully inside the window, found without the search code. */
const tripsWithDepartureInside = (from: string, to: string, maxPrice = Infinity) =>
  trips
    .filter((t) => t.tours.some((d) => isBookable(d) && d.startingDate >= from && d.endingDate <= to && d.priceEur <= maxPrice))
    .map((t) => t.id);

describe('case: "USA"', () => {
  it("is not an alias: the words are searched as they are", () => {
    const state = translate({ text: "USA" });
    expect(state).toMatchObject({ text: "usa", destinations: [] });
  });

  it("finds the one itinerary line that says USA (Puerto Rico), whole words only: not Busan, not 'thousand'", () => {
    const { ids, exact } = run({ text: "USA" });
    expect(exact).toBe(true);
    expect(ids).toEqual([33]);
    // "usa" is inside Busan (28) and thousand (2, 4, 11, 43)
    for (const id of [28, 2, 4, 11, 43]) expect(ids).not.toContain(id);
  });

  it("finds New York for the catalog's own name, United States", () => {
    expect(run({ text: "United States" }).ids).toEqual([22]);
  });
});

describe('case: "northern lights"', () => {
  it("is the trip type: the three trips of that type, not a text match", () => {
    const { ids, exact, originalState } = run({ text: "northern lights" });
    expect(originalState.tripTypes).toEqual(["Northern Lights"]);
    expect(exact).toBe(true);
    expect(ids).toEqual(trips.filter((t) => t.travelTypes.includes("Northern Lights")).map((t) => t.id));
    expect(ids).toEqual([9, 11, 41]);
  });
});

describe('case: "New Year\'s Eve"', () => {
  it("is in no trip's text: the page shows the nearest options and says what was loosened, never nothing", () => {
    const { ids, exact, results, originalState } = run({ text: "New Year's Eve" });
    expect(exact).toBe(false);
    expect(ids.length).toBeGreaterThan(0);
    expect(results.every((r) => loosenedKeys(originalState, r.state).join() === "text")).toBe(true);
  });

  it("is a question for the dates: 39 departures run over the night of 31 December", () => {
    const over = trips.flatMap((t) => t.tours).filter((d) => d.startingDate <= "2026-12-31" && d.endingDate >= "2027-01-01");
    expect(over).toHaveLength(39);
  });

  it("is answered by a date window around it: exactly the trips with a bookable departure inside it", () => {
    const window = { from: "2026-12-28", to: "2027-01-03" };
    const { ids, exact } = run({ text: "", dates: window });
    expect(exact).toBe(true);
    expect(ids.sort((a, b) => a - b)).toEqual(tripsWithDepartureInside(window.from, window.to));
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe('case: "cooking class"', () => {
  it("is not a filter: the words are searched in the trips' text, which finds three trips", () => {
    expect(run({ text: "cooking class" }).ids).toEqual([13, 15, 19]);
  });

  it("finds five trips for the word alone, the way the agent narrows through the search", () => {
    expect(run({ text: "cooking" }).ids).toEqual([13, 15, 19, 24, 40]);
  });
});

describe('case: "hiking in Brazil or Argentina end of September"', () => {
  it("finds no exact trip: there is none in Brazil, and Patagonia has no September departure", () => {
    expect(trips.some((t) => t.destination === "Brazil")).toBe(false);
    const patagonia = trips.find((t) => t.id === 23)!;
    expect(patagonia.tours.some((d) => d.startingDate.slice(5, 7) === "09")).toBe(false);
  });

  it("shows Patagonia as the nearest option, with the words (Brazil) loosened, the destination kept", () => {
    const { ids, results, originalState, exact } = run({ text: "hiking in Brazil or Argentina" });
    expect(exact).toBe(false);
    expect(ids).toEqual([23]);
    expect(loosenedKeys(originalState, results[0].state)).toEqual(["text"]);
    expect(results[0].state.destinations).toEqual(["Argentina"]);
  });
});

describe('case: "ok, any period, but max 2,000"', () => {
  it("is every trip with a bookable departure of 2,000 or less, with no dates", () => {
    const { ids, exact, originalState, results } = run({ text: "", maxPrice: 2000 });
    expect(originalState.dates).toBeUndefined();
    expect(exact).toBe(true);
    expect(ids.sort((a, b) => a - b)).toEqual(tripsWithDepartureInside("0000-01-01", "9999-12-31", 2000));
    expect(results.every((r) => r.fromPrice <= 2000)).toBe(true);
  });

  it("is a different search from the same words with dates: dropping the dates widens it", () => {
    const withDates = run({ text: "", maxPrice: 2000, dates: { from: "2026-12-01", to: "2026-12-31" } });
    const anyPeriod = run({ text: "", maxPrice: 2000 });
    expect(anyPeriod.ids.length).toBeGreaterThan(withDates.ids.length);
    for (const id of withDates.ids) expect(anyPeriod.ids).toContain(id);
  });
});

describe('case: "I only have 19-24 October"', () => {
  const window = { from: "2026-10-19", to: "2026-10-24" };

  it("fits no trip: the three departures inside the window (trips 3, 30, 36) can't be booked", () => {
    expect(tripsWithDepartureInside(window.from, window.to)).toEqual([]);
    const inside = trips.flatMap((t) => t.tours).filter((d) => d.startingDate >= window.from && d.endingDate <= window.to);
    expect(inside.map((d) => d.id).sort()).toEqual(["3-1", "30-2", "36-1"]);
    expect(inside.every((d) => d.salesStatus === "NOT_AVAILABLE")).toBe(true);
  });

  it("gives the nearest bookable departures of the trips on screen, and how far they are, as a departures question", () => {
    const result = getDepartures({ onScreen: [3, 30, 36], ...window });
    expect(result.noTripFitsWindow).toBe(true);
    expect(result.trips.every((t) => t.departures.length === 0)).toBe(true);
    expect(result.trips[0].nearestAfter).toMatchObject({ id: "3-2", how: "starts 3 days after the window ends" });
  });

  it("is a search the page never leaves empty: the 10 nearest options, each with the dates loosened", () => {
    const { results, exact, originalState } = run({ text: "", dates: window });
    expect(exact).toBe(false);
    expect(results).toHaveLength(10);
    expect(results.every((r) => loosenedKeys(originalState, r.state).join() === "dates")).toBe(true);
  });
});

describe('case: "Do I need a visa?"', () => {
  const all = [...getFaq({}).articles, ...trips.map((t) => t.destination).flatMap((d) => getFaq({ destination: d }).articles)];

  it("has no article: none is about visas or entry requirements", () => {
    const about = all.filter((a) => /visa (?:requirement|application)|entry requirement|passport|embassy|consulate/i.test(`${a.title} ${a.body}`));
    expect(about).toEqual([]);
  });

  it("has one article that says 'visa', and it is the payment methods: Visa the card", () => {
    const mentions = [...new Map(all.filter((a) => /visa/i.test(a.title + a.body)).map((a) => [a.id, a])).values()];
    expect(mentions.map((a) => a.id)).toEqual([5]);
    expect(mentions[0].body).toMatch(/Visa, Mastercard/);
  });

  it("is not answerable from the destination's article either: each covers one practical topic", () => {
    const topics = /weather|currency|plug|tip|sim|wi-?fi|internet/i;
    const destinationArticles = all.filter((a) => a.scope === "destination");
    expect(destinationArticles.length).toBeGreaterThan(0);
    expect(destinationArticles.every((a) => topics.test(a.title))).toBe(true);
  });
});
