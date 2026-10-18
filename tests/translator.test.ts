import { describe, expect, it } from "vitest";
import { searchTrips } from "@/lib/search/mockApi";
import { translate } from "@/lib/search/translator";

const read = (text: string, filters = {}) => translate({ text, ...filters });

describe("destinations", () => {
  it("takes a destination out of the text", () => {
    const state = read("hiking in Argentina");
    expect(state.destinations).toEqual(["Argentina"]);
    expect(state.text).toBe("hiking");
  });

  it("collects every destination it finds", () => {
    const state = read("Peru or Argentina in december");
    expect(state.destinations.sort()).toEqual(["Argentina", "Peru"]);
    expect(state.text).toBe("december");
  });

  it("reads destinations of two words", () => {
    expect(read("United States").destinations).toEqual(["United States"]);
    expect(read("a trip to Puerto Rico").destinations).toEqual(["Puerto Rico"]);
    expect(read("south africa safari").destinations).toEqual(["South Africa"]);
  });

  it("leaves a place that is not in the catalog as text", () => {
    const state = read("hiking in Brazil or Argentina end of September");
    expect(state.destinations).toEqual(["Argentina"]);
    expect(state.text).toBe("hiking brazil end september");
  });

  it("does not map USA to the United States", () => {
    const state = read("USA");
    expect(state.destinations).toEqual([]);
    expect(state.text).toBe("usa");
  });

  it("ignores case and accents", () => {
    expect(read("ICELAND").destinations).toEqual(["Iceland"]);
  });
});

describe("trip types", () => {
  it("maps northern lights to its trip type", () => {
    const state = read("northern lights");
    expect(state.tripTypes).toEqual(["Northern Lights"]);
    expect(state.text).toBe("");
  });

  it("reads types of several words, and several types", () => {
    expect(read("on the road").tripTypes).toEqual(["On the road"]);
    expect(read("beach life and safari").tripTypes.sort()).toEqual(["Beach Life", "Safari"]);
  });

  it("leaves what is not a trip type as text", () => {
    const state = read("cooking class");
    expect(state.tripTypes).toEqual([]);
    expect(state.text).toBe("cooking class");
  });
});

describe("price", () => {
  it.each([
    ["under 2000", 2000],
    ["max 2,000 euros", 2000],
    ["less than €1.500", 1500],
    ["up to 2k", 2000],
    ["below 800 eur", 800],
    ["Maximum €900", 900],
  ])("reads %s", (phrase, maxPrice) => {
    const state = read(`japan ${phrase}`);
    expect(state.maxPrice).toBe(maxPrice);
    expect(state.destinations).toEqual(["Japan"]);
    expect(state.text).toBe("");
  });

  it("does not take a k that starts a word", () => {
    const state = read("under 2000 kyrgyzstan");
    expect(state.maxPrice).toBe(2000);
    expect(state.destinations).toEqual(["Kyrgyzstan"]);
  });

  it("lets the price filter win over the price in the text", () => {
    const state = read("japan under 2000", { maxPrice: 1500 });
    expect(state.maxPrice).toBe(1500);
    expect(state.text).toBe("");
  });

  it("leaves numbers that are not a price as text", () => {
    expect(read("5 days").maxPrice).toBeUndefined();
  });
});

describe("the rest", () => {
  it("drops filler words", () => {
    expect(read("trips to the beach with a view").text).toBe("beach view");
  });

  it("passes the filters through", () => {
    const filters = { dates: { from: "2026-10-19", to: "2026-10-24" }, privateRoom: true, ageBand: "25-35" as const };
    expect(read("japan", filters)).toMatchObject(filters);
  });

  it("reads an empty search bar", () => {
    expect(read("")).toEqual({ text: "", destinations: [], tripTypes: [] });
  });
});

describe("translator and mock API together", () => {
  it("finds the Northern Lights trips for 'northern lights', which a text match alone would not map", () => {
    const found = searchTrips(read("northern lights"));
    expect(found.map((r) => r.trip.id)).toEqual([9, 11, 41]);
  });

  it("finds Patagonia for 'hiking in Argentina', and nothing under 2000 (its departures cost over 4,000)", () => {
    expect(searchTrips(read("hiking in Argentina")).map((r) => r.trip.id)).toEqual([23]);
    expect(searchTrips(read("hiking in Argentina under 2000"))).toEqual([]);
  });

  it("finds nothing when a place has no trip", () => {
    expect(searchTrips(read("hiking in Brazil"))).toEqual([]);
  });
});
