import { describe, expect, it } from "vitest";
import { search } from "@/lib/search/search";

describe("search function", () => {
  it("returns the state it read and the results, each with the state that found it", () => {
    const { originalState, results } = search({ text: "northern lights under 2000" });
    expect(originalState).toMatchObject({ text: "", tripTypes: ["Northern Lights"], maxPrice: 2000 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.state === originalState)).toBe(true);
    expect(results.every((r) => r.fromPrice <= 2000)).toBe(true);
  });

  it("gives the same results in the same order every time", () => {
    const request = { text: "culture", maxPrice: 3000 };
    const ids = () => search(request).results.map((r) => r.trip.id);
    expect(ids()).toEqual(ids());
  });

  it("returns every trip for an empty search", () => {
    expect(search({ text: "" }).results).toHaveLength(50);
  });

  it("lets a filter win over the text", () => {
    const { originalState } = search({ text: "japan under 2000", maxPrice: 1500 });
    expect(originalState.maxPrice).toBe(1500);
  });

  it("survives a trip through JSON, as it does between the server and the page", () => {
    const output = search({ text: "japan", dates: { from: "2026-11-01", to: "2027-03-01" } });
    expect(JSON.parse(JSON.stringify(output))).toEqual(output);
  });

  it("returns the nearest options when nothing matches, each with the state that found it", () => {
    const { originalState, results } = search({ text: "hiking in Argentina under 2000" });
    expect(results.length).toBeGreaterThan(0);
    // Patagonia costs over 4,000: found with the price loosened
    expect(results[0].trip.id).toBe(23);
    expect(results[0].state).toEqual({ ...originalState, maxPrice: undefined });
    expect(results[0].state.maxPrice).toBeUndefined();
  });

  it("keeps exact matches as they are, without suggestions", () => {
    const { originalState, results } = search({ text: "northern lights" });
    expect(results.map((r) => r.trip.id)).toEqual([9, 11, 41]);
    expect(results.every((r) => r.state === originalState)).toBe(true);
  });
});
