import { describe, expect, it } from "vitest";
import { isBookable, trips } from "@/lib/search/catalog";
import { searchTrips } from "@/lib/search/mockApi";
import type { SearchState } from "@/lib/search/types";

const search = (state: Partial<SearchState>) =>
  searchTrips({ text: "", destinations: [], tripTypes: [], ...state });
const ids = (state: Partial<SearchState>) => search(state).map((r) => r.trip.id);

describe("mock API", () => {
  it("returns every trip in the data's order for an empty search", () => {
    expect(ids({})).toEqual(trips.map((t) => t.id));
  });

  it("returns only bookable departures, with the cheapest as the price", () => {
    for (const result of search({})) {
      expect(result.departures.every(isBookable)).toBe(true);
      expect(result.fromPrice).toBe(Math.min(...result.departures.map((d) => d.priceEur)));
    }
  });
});

describe("text", () => {
  it("matches whole words in the trip's text", () => {
    expect(ids({ text: "cooking" })).toEqual([13, 15, 19, 24, 40]);
  });

  it("needs every word", () => {
    expect(ids({ text: "cooking class" })).toEqual([13, 15, 19]);
  });

  it("ignores case and accents", () => {
    // trip 18 writes "Yucatán" and "Chichén Itzá"
    expect(ids({ text: "YUCATAN chichen" })).toContain(18);
  });

  it("does not match inside other words", () => {
    // "usa" is inside Busan (28) and thousand (2, 4, 11, 43); it is a word only in trip 33
    expect(ids({ text: "usa" })).toEqual([33]);
  });

  it("finds nothing for words that are not in the catalog", () => {
    expect(ids({ text: "new year's eve" })).toEqual([]);
  });
});

describe("trip filters", () => {
  it("matches a trip if its destination is any of the destinations", () => {
    const found = search({ destinations: ["Peru", "Argentina"] });
    expect(found.map((r) => r.trip.destination).sort()).toEqual(["Argentina", "Peru"]);
  });

  it("needs all the trip types", () => {
    expect(ids({ tripTypes: ["Northern Lights"] })).toEqual([9, 11, 41]);
    expect(ids({ tripTypes: ["Northern Lights", "Beach Life"] })).toEqual([]);
  });

  it("filters by duration and physical effort", () => {
    const short = search({ days: { max: 3 } });
    expect(short.length).toBeGreaterThan(0);
    expect(short.every((r) => r.trip.numberOfDays <= 3)).toBe(true);
    const long = search({ days: { min: 13 } });
    expect(long.every((r) => r.trip.numberOfDays >= 13)).toBe(true);
    const hard = search({ physicalRating: "HIGH" });
    expect(hard).toHaveLength(4);
  });

  it("combines the text with the filters", () => {
    expect(ids({ text: "hiking", destinations: ["Argentina"] })).toEqual([23]);
  });
});

describe("departure filters", () => {
  it("keeps only the trips with a bookable departure fully inside the dates", () => {
    const dates = { from: "2026-12-28", to: "2027-01-05" };
    const found = search({ dates });
    expect(found.length).toBeGreaterThan(0);
    for (const result of found) {
      expect(result.departures.every((d) => d.startingDate >= dates.from && d.endingDate <= dates.to)).toBe(true);
    }
  });

  it("finds nothing for 19–24 October, where the only departures are not bookable", () => {
    expect(ids({ dates: { from: "2026-10-19", to: "2026-10-24" } })).toEqual([]);
  });

  it("filters by price and shows the cheapest matching departure", () => {
    const found = search({ maxPrice: 1000 });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((r) => r.fromPrice <= 1000)).toBe(true);
    expect(found.every((r) => r.departures.every((d) => d.priceEur <= 1000))).toBe(true);
  });

  it("needs the date window and the price to hold on the same departure", () => {
    // trip 2 has a bookable departure at 2629 (2-6, January) and one at 3209 inside this window (2-3)
    const dates = { from: "2026-11-04", to: "2026-11-14" };
    expect(ids({ dates })).toContain(2);
    expect(ids({ dates, maxPrice: 3000 })).not.toContain(2);
  });

  it("filters by age band and private room", () => {
    const young = search({ ageBand: "18-25" });
    expect(young.length).toBeGreaterThan(0);
    expect(young.every((r) => r.departures.every((d) => d.ageBand === "18-25"))).toBe(true);
    const room = search({ privateRoom: true });
    expect(room.every((r) => r.departures.every((d) => d.privateRoomBookable))).toBe(true);
  });
});
