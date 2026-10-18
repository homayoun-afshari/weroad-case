import { describe, expect, it } from "vitest";
import { isBookable } from "@/lib/search/catalog";
import { outsideBy } from "@/lib/search/departures";
import { describeLoosened, drop, isSet, loosenedKeys, LOOSEN_ORDER } from "@/lib/search/loosening";
import { MAX_SUGGESTIONS, suggest } from "@/lib/search/suggester";
import { search } from "@/lib/search/search";
import { translate } from "@/lib/search/translator";
import type { SearchRequest } from "@/lib/search/types";

const run = (request: SearchRequest) => {
  const { originalState, results } = search(request);
  return { originalState, results, ids: results.map((r) => r.trip.id), loosened: results.map((r) => loosenedKeys(originalState, r.state)) };
};

describe("when nothing matches", () => {
  it("is not used when something matches: the exact results stand alone", () => {
    const { originalState, results, loosened } = run({ text: "northern lights" });
    expect(results.every((r) => r.state === originalState)).toBe(true);
    expect(loosened.every((k) => k.length === 0)).toBe(true);
  });

  it("loosens one value at a time: 'hiking in Argentina under 2000' finds Patagonia with the price loosened", () => {
    const { ids, loosened, results, originalState } = run({ text: "hiking in Argentina under 2000" });
    expect(originalState).toMatchObject({ text: "hiking", destinations: ["Argentina"], maxPrice: 2000 });
    // Patagonia (4,169) first: the price is the value loosened first
    expect(ids[0]).toBe(23);
    expect(results[0].fromPrice).toBe(4169);
    expect(loosened[0]).toEqual(["maxPrice"]);
    expect(results[0].state).toMatchObject({ text: "hiking", destinations: ["Argentina"] });
    expect(results[0].state.maxPrice).toBeUndefined();
  });

  it("gives each result the state that found it, and the later ones keep the price", () => {
    const { results, loosened } = run({ text: "hiking in Argentina under 2000" });
    // after Patagonia: other hiking trips within the price, with the destination loosened
    const rest = results.slice(1);
    expect(rest.length).toBeGreaterThan(0);
    expect(loosened.slice(1).every((k) => k.length === 1 && k[0] === "destinations")).toBe(true);
    expect(rest.every((r) => r.state.maxPrice === 2000 && r.state.destinations.length === 0 && r.fromPrice <= 2000)).toBe(true);
  });

  it("answers 'under 800 in Japan' with Japan first, over the price, then trips within it", () => {
    const { results, loosened } = run({ text: "japan under 800" });
    expect(results[0].trip.destination).toBe("Japan");
    expect(results[0].fromPrice).toBeGreaterThan(800);
    expect(loosened[0]).toEqual(["maxPrice"]);
    expect(results.slice(1).every((r) => r.fromPrice <= 800)).toBe(true);
  });

  it("answers 'all trips for 19-24 October': the nearest to the dates first, and no more than the cap", () => {
    const request = { text: "", dates: { from: "2026-10-19", to: "2026-10-24" } };
    const { results, loosened } = run(request);
    expect(results).toHaveLength(MAX_SUGGESTIONS);
    expect(loosened.every((k) => k.length === 1 && k[0] === "dates")).toBe(true);
    // ordered by how far each result's nearest departure is from the dates
    const gap = (r: (typeof results)[number]) => Math.min(...r.departures.map((d) => outsideBy(d, request.dates)));
    const gaps = results.map(gap);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(gaps[0]).toBeGreaterThan(0); // none fits, or it would have been an exact match
  });

  it("orders by the fixed order: dates, then price, then the trip types; a trip found twice is listed once", () => {
    const { ids, loosened } = run({ text: "northern lights", maxPrice: 1500, dates: { from: "2026-12-01", to: "2026-12-08" } });
    expect(ids.slice(0, 2)).toEqual([9, 11]);
    expect(loosened[0]).toEqual(["dates"]); // Iceland: within the price, outside the dates
    expect(loosened[1]).toEqual(["maxPrice"]); // Sweden: in the dates, over the price
    expect(loosened.slice(2).every((k) => k[0] === "tripTypes")).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("loosens the words first and keeps the destination: 'hiking in Brazil or Argentina end of September'", () => {
    const { ids, loosened, results } = run({ text: "hiking in Brazil or Argentina end of September" });
    expect(ids).toEqual([23]);
    expect(loosened).toEqual([["text"]]);
    expect(results[0].state.destinations).toEqual(["Argentina"]);
  });

  it("falls back to the trip types before the destination: 'northern lights in Brazil'", () => {
    const { ids, loosened } = run({ text: "northern lights in Brazil" });
    expect(ids).toEqual([9, 11, 41]);
    expect(loosened.every((k) => k.length === 1 && k[0] === "text")).toBe(true);
  });

  it("loosens the duration as one value", () => {
    const { ids, loosened } = run({ text: "japan", days: { min: 100, max: 200 } });
    expect(ids).toEqual([2]);
    expect(loosened).toEqual([["days"]]);
  });

  it("loosens several values together when each alone still finds nothing", () => {
    // Iceland costs over 500 and has nothing in the dates; the dates and the price must both go
    const { ids, loosened } = run({ text: "iceland", dates: { from: "2026-10-19", to: "2026-10-24" }, maxPrice: 500 });
    expect(ids).toEqual([9]);
    expect(loosened).toEqual([["dates", "maxPrice"]]);
  });

  it("never returns an empty page while a trip can be booked", () => {
    const strict: SearchRequest = {
      text: "zzz",
      maxPrice: 1,
      ageBand: "18-25",
      physicalRating: "HIGH",
      privateRoom: true,
      days: { min: 100 },
      dates: { from: "2026-10-19", to: "2026-10-20" },
    };
    const { results, loosened } = run(strict);
    expect(results).toHaveLength(MAX_SUGGESTIONS);
    expect(loosened[0]).toEqual(["dates", "maxPrice", "days", "ageBand", "physicalRating", "privateRoom", "text"]);
  });

  it("offers only departures that can be booked", () => {
    const { results } = run({ text: "", dates: { from: "2026-10-19", to: "2026-10-24" } });
    for (const result of results) expect(result.departures.every(isBookable)).toBe(true);
  });

  it("returns nothing only when there is nothing to loosen", () => {
    expect(suggest(translate({ text: "" }))).toEqual([]);
  });
});

describe("loosening", () => {
  it("is in the fixed order: dates, price, duration, the other filters, then the text", () => {
    expect(LOOSEN_ORDER).toEqual(["dates", "maxPrice", "days", "ageBand", "physicalRating", "privateRoom", "text", "tripTypes", "destinations"]);
  });

  it("drops one value and leaves the others", () => {
    const state = translate({ text: "hiking in Argentina", maxPrice: 2000, privateRoom: true });
    expect(isSet(state, "privateRoom")).toBe(true);
    const without = drop(state, "privateRoom");
    expect(isSet(without, "privateRoom")).toBe(false);
    expect(without).toMatchObject({ text: "hiking", destinations: ["Argentina"], maxPrice: 2000 });
    expect(isSet(state, "privateRoom")).toBe(true); // the original is unchanged
  });

  it("tells which values a state no longer has", () => {
    const original = translate({ text: "hiking in Argentina under 2000" });
    expect(loosenedKeys(original, drop(original, "maxPrice"))).toEqual(["maxPrice"]);
    expect(loosenedKeys(original, original)).toEqual([]);
  });

  it("names them in words", () => {
    expect(describeLoosened(["maxPrice"])).toBe("max price");
    expect(describeLoosened(["dates", "maxPrice"])).toBe("dates and max price");
    expect(describeLoosened(["dates", "maxPrice", "days"])).toBe("dates, max price and duration");
    expect(describeLoosened([])).toBe("");
  });
});
