import { describe, expect, it } from "vitest";
import { trips } from "@/lib/search/catalog";
import { getItinerary } from "@/lib/search/itinerary";
import { itineraryInputSchema } from "@/lib/search/schema";

const allIds = trips.map((t) => t.id);

describe("the itinerary of a trip on screen", () => {
  it("gives each day's title and highlights, as the data has them", () => {
    const result = getItinerary({ tripId: 9, onScreen: allIds });
    expect(result).toMatchObject({ onScreen: true, destination: "Iceland", numberOfDays: 8 });
    expect(result.days).toHaveLength(8);
    expect(result.days[2]).toEqual({
      day: 3,
      title: "Golden Circle: Geysir, Gullfoss, Secret Lagoon",
      nights: null,
      highlights: ["Geysir", "Gullfoss waterfall"],
    });
    expect(result.notes).toEqual([]);
  });

  it("says null where the group sleeps when the data doesn't say, and keeps it when it does", () => {
    const real = trips.find((t) => t.id === 1)!.itinerary[0];
    const day = getItinerary({ tripId: 1, onScreen: allIds }).days[0];
    expect(real.nights).toBe("Naples");
    expect(day.nights).toBe("Naples");
    const empty = trips.flatMap((t) => t.itinerary).filter((d) => !d.nights);
    expect(empty.length).toBeGreaterThan(200);
    for (const trip of trips) {
      for (const d of getItinerary({ tripId: trip.id, onScreen: allIds }).days) expect(d.nights === null || d.nights.length > 0).toBe(true);
    }
  });

  it("says so when the itinerary is a day shorter than the trip: 11 trips are", () => {
    const short = trips.filter((t) => t.itinerary.length < t.numberOfDays);
    expect(short).toHaveLength(11);
    expect(getItinerary({ tripId: 7, onScreen: allIds }).notes).toEqual(["The itinerary lists 12 of the trip's 13 days."]);
    const withNote = allIds.filter((id) => getItinerary({ tripId: id, onScreen: allIds }).notes.length > 0);
    expect(withNote.sort((a, b) => a - b)).toEqual(short.map((t) => t.id).sort((a, b) => a - b));
  });

  it("answers only for trips on screen", () => {
    const result = getItinerary({ tripId: 3, onScreen: [9, 11, 41] });
    expect(result).toEqual({ tripId: 3, onScreen: false, days: [], notes: ["Trip 3 is not on the page."] });
  });

  it("answers a trip that does not exist like one that is not on screen", () => {
    expect(getItinerary({ tripId: 999, onScreen: [999] }).onScreen).toBe(false);
  });

  it("stays small enough to send with a turn", () => {
    for (const id of allIds) expect(JSON.stringify(getItinerary({ tripId: id, onScreen: allIds })).length).toBeLessThan(3000);
  });
});

describe("the tool's input", () => {
  it("takes a whole number", () => {
    expect(itineraryInputSchema.safeParse({ tripId: 9 }).success).toBe(true);
    expect(itineraryInputSchema.safeParse({ tripId: "9" }).success).toBe(false);
    expect(itineraryInputSchema.safeParse({}).success).toBe(false);
  });
});
