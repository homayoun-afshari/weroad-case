import { describe, expect, it } from "vitest";
import { isBookable, isUpcoming, trips } from "@/lib/search/catalog";
import { getDepartures, MAX_DEPARTURES, MAX_TRIPS } from "@/lib/search/departures";
import { departuresInputSchema } from "@/lib/search/schema";

const allIds = trips.map((t) => t.id);
const ask = (options: { tripIds?: number[]; from?: string; to?: string; onScreen?: number[] }) =>
  getDepartures({ onScreen: allIds, ...options });
const ids = (r: ReturnType<typeof ask>, tripId: number) => r.trips.find((t) => t.tripId === tripId)!.departures.map((d) => d.id);

describe("departures of trips on screen", () => {
  it("offers only upcoming, bookable departures, by date", () => {
    const result = ask({ tripIds: allIds.slice(0, MAX_TRIPS) });
    for (const trip of result.trips) {
      const real = trips.find((t) => t.id === trip.tripId)!.tours;
      for (const d of trip.departures) {
        const source = real.find((x) => x.id === d.id)!;
        expect(isBookable(source)).toBe(true);
      }
      expect(trip.departures.map((d) => d.startingDate)).toEqual([...trip.departures.map((d) => d.startingDate)].sort());
    }
  });

  it("never offers a departure that already left, whatever its status", () => {
    // 25-1 is ALMOST_FULL, a bookable status, but it started before 2026-10-16
    expect(ids(ask({ tripIds: [25] }), 25)).not.toContain("25-1");
    const all = ask({ tripIds: [4, 25, 27, 31, 49] });
    expect(all.trips.flatMap((t) => t.departures).every((d) => d.startingDate >= "2026-10-16")).toBe(true);
  });

  it("never offers sold out or not available departures", () => {
    // trip 3 has NOT_AVAILABLE departures (3-1, 3-3, 3-5)
    const found = ids(ask({ tripIds: [3] }), 3);
    expect(found).not.toContain("3-1");
    expect(found).not.toContain("3-3");
    expect(found).not.toContain("3-5");
  });

  it("reads the seats left from the data's field, not from group size minus bookings", () => {
    // 2-6: seatsLeft 6, but maxPax 14 minus paxBooked 7 would say 7
    const d = ask({ tripIds: [2] }).trips[0].departures.find((x) => x.id === "2-6")!;
    expect(d.seatsLeft).toBe(6);
  });

  it("shows the price and the price before the discount", () => {
    const d = ask({ tripIds: [4] }).trips[0].departures.find((x) => x.id === "4-6")!;
    expect(d.priceEur).toBe(2469);
    expect(d.fullPriceEur).toBe(2779);
    expect(ask({ tripIds: [3] }).trips[0].departures[0].fullPriceEur).toBeNull();
  });

  it("marks PLANNED and ALMOST_CONFIRMED as not confirmed, and says to wait before buying flights", () => {
    const result = ask({ tripIds: [3], from: "2026-12-10", to: "2026-12-20" });
    expect(result.trips[0].departures).toMatchObject([{ id: "3-6", status: "ALMOST_CONFIRMED", confirmed: false }]);
    expect(result.notes.join(" ")).toContain("wait for the departure to be confirmed before buying flights (article 7)");
    const confirmed = ask({ tripIds: [3], from: "2027-01-01", to: "2027-01-10" });
    expect(confirmed.trips[0].departures).toMatchObject([{ id: "3-7", status: "CONFIRMED", confirmed: true }]);
    expect(confirmed.notes).toEqual([]);
  });

  it("keeps ALMOST_FULL bookable, with its few seats", () => {
    const d = ask({ tripIds: [3] }).trips[0].departures.find((x) => x.id === "3-4")!;
    expect(d.status).toBe("ALMOST_FULL");
    expect(d.confirmed).toBe(true);
  });

  it("shows at most five departures and counts the rest", () => {
    const trip = ask({ tripIds: [10] }).trips[0];
    expect(trip.departures).toHaveLength(MAX_DEPARTURES);
    expect(trip.omitted).toBe(5);
  });
});

describe("a date window", () => {
  it("matches departures fully inside it", () => {
    const result = ask({ tripIds: [3], from: "2027-01-01", to: "2027-01-10" });
    expect(ids(result, 3)).toEqual(["3-7"]); // 3-8 runs 12–16 January
    expect(result.noTripFitsWindow).toBe(false);
  });

  it("gives the nearest alternatives only when no trip on screen fits", () => {
    const fits = ask({ tripIds: [3, 30], from: "2027-01-01", to: "2027-01-10" });
    // trip 3 fits; trip 30 has no departure in the window, but alternatives are not offered
    expect(fits.trips.every((t) => t.nearestBefore === null && t.nearestAfter === null)).toBe(true);
  });

  it("answers 'I only have 19-24 October' with the nearest bookable departures and how far they are", () => {
    const result = ask({ tripIds: [3, 30, 36], from: "2026-10-19", to: "2026-10-24" });
    expect(result.noTripFitsWindow).toBe(true);
    expect(result.trips.every((t) => t.departures.length === 0)).toBe(true);

    const morocco = result.trips[0];
    expect(morocco.nearestBefore).toBeNull(); // 3-1 is NOT_AVAILABLE
    expect(morocco.nearestAfter).toMatchObject({ id: "3-2", startingDate: "2026-10-27", how: "starts 3 days after the window ends" });

    const hungary = result.trips[1];
    expect(hungary.nearestBefore).toBeNull(); // 30-1 is a waiting-list departure, not a bookable one
    expect(hungary.nearestAfter).toMatchObject({ id: "30-5", how: "starts 18 days after the window ends" });

    expect(result.trips[2].nearestAfter).toMatchObject({ id: "36-3" });
  });

  it("counts a departure that starts in the window and ends after it as sticking out", () => {
    const result = ask({ tripIds: [2], from: "2026-11-01", to: "2026-11-09" });
    // 2-3 runs 4–14 November
    expect(result.trips[0].nearestAfter).toMatchObject({ id: "2-3", how: "ends 5 days after the window ends" });
  });

  it("lists waiting-list departures apart, never as bookable, and says what that means", () => {
    const result = ask({ tripIds: [2], from: "2026-10-30", to: "2026-11-09" });
    const trip = result.trips[0];
    expect(trip.waitingList).toMatchObject([{ id: "2-2", status: "WAITING_LIST", seatsLeft: 0 }]);
    expect(trip.departures).toEqual([]);
    expect(result.noTripFitsWindow).toBe(true); // a waiting list is not a fit
    expect(trip.nearestAfter).not.toBeNull(); // a bookable alternative comes with it
    expect(result.notes.join(" ")).toContain("a seat is not guaranteed");
    expect(result.notes.join(" ")).toContain("nothing is known about how the waiting list works");
  });

  it("lists upcoming waiting-list departures when there is no window", () => {
    expect(ask({ tripIds: [20] }).trips[0].waitingList.map((d) => d.id)).toEqual(["20-1"]);
  });
});

describe("which trips", () => {
  it("answers for all the trips on screen, in the page's order, when none is named", () => {
    const result = getDepartures({ onScreen: [9, 11, 41] });
    expect(result.trips.map((t) => t.tripId)).toEqual([9, 11, 41]);
  });

  it("looks at no more than ten trips, and says how many of those on screen it checked", () => {
    const result = getDepartures({ onScreen: allIds });
    expect(result.trips).toHaveLength(MAX_TRIPS);
    expect(result.tripsOnScreen).toBe(50);
    expect(result.tripsChecked).toBe(MAX_TRIPS);
    expect(result.notes).toContain("Only the first 10 of the 50 trips on screen were checked, in the page's order.");
  });

  it("adds no such note when every trip on screen is covered, or when trips were named", () => {
    const few = getDepartures({ onScreen: [9, 11, 41] });
    expect(few.tripsChecked).toBe(3);
    expect(few.notes.join(" ")).not.toContain("were checked");
    const named = getDepartures({ tripIds: [9], onScreen: allIds });
    expect(named.tripsChecked).toBe(1);
    expect(named.notes.join(" ")).not.toContain("were checked");
  });

  it("only answers for trips on screen, and says which asked-for trips are not", () => {
    const result = getDepartures({ tripIds: [9, 3], onScreen: [9, 11] });
    expect(result.trips.map((t) => t.tripId)).toEqual([9]);
    expect(result.notOnScreen).toEqual([3]);
  });
});

describe("the tool's input", () => {
  const ok = (input: unknown) => departuresInputSchema.safeParse(input).success;

  it("accepts a window with both ends, or none", () => {
    expect(ok({})).toBe(true);
    expect(ok({ from: "2026-10-19", to: "2026-10-24" })).toBe(true);
    expect(ok({ tripIds: [9] })).toBe(true);
  });

  it("rejects half a window, a reversed window, and bad ids", () => {
    expect(ok({ from: "2026-10-19" })).toBe(false);
    expect(ok({ from: "2026-10-24", to: "2026-10-19" })).toBe(false);
    expect(ok({ tripIds: [] })).toBe(false);
    expect(ok({ from: "19 October", to: "24 October" })).toBe(false);
  });
});

describe("the data this relies on", () => {
  it("has the four waiting-list departures and the past ones the rules drop", () => {
    const all = trips.flatMap((t) => t.tours);
    expect(all.filter((d) => d.salesStatus === "WAITING_LIST").map((d) => d.id).sort()).toEqual(["2-2", "20-1", "30-1", "38-2"]);
    expect(all.filter((d) => !isUpcoming(d))).toHaveLength(5);
  });
});
