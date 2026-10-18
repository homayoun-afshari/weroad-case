import { describe, expect, it } from "vitest";
import {
  destinations,
  faqs,
  isBookable,
  isUpcoming,
  isWaitingList,
  trips,
} from "@/lib/search/catalog";

const departures = trips.flatMap((t) => t.tours);

describe("catalog", () => {
  it("loads the given data", () => {
    expect(trips).toHaveLength(50);
    expect(departures).toHaveLength(500);
    expect(faqs).toHaveLength(50);
    expect(destinations).toHaveLength(50);
  });
});

describe("bookability", () => {
  it("drops the 5 departures that start before today, whatever their status", () => {
    const past = departures.filter((d) => !isUpcoming(d));
    expect(past.map((d) => d.id).sort()).toEqual(["25-1", "27-1", "31-1", "4-1", "49-1"]);
    expect(past.some(isBookable)).toBe(false);
    // 25-1 is ALMOST_FULL, a bookable status, but it already left
    expect(departures.find((d) => d.id === "25-1")?.salesStatus).toBe("ALMOST_FULL");
  });

  it("never reads bookability from seats left", () => {
    const notAvailableWithSeats = departures.filter(
      (d) => d.salesStatus === "NOT_AVAILABLE" && d.seatsLeft > 0,
    );
    expect(notAvailableWithSeats.length).toBeGreaterThan(100);
    expect(notAvailableWithSeats.some(isBookable)).toBe(false);
  });

  it("books the four bookable statuses, and no others", () => {
    const bookable = departures.filter(isBookable);
    expect(bookable).toHaveLength(330);
    expect(new Set(bookable.map((d) => d.salesStatus))).toEqual(
      new Set(["PLANNED", "ALMOST_CONFIRMED", "CONFIRMED", "ALMOST_FULL"]),
    );
  });

  it("keeps the waiting list apart from the bookable departures", () => {
    const waiting = departures.filter(isWaitingList);
    expect(waiting).toHaveLength(4);
    expect(waiting.some(isBookable)).toBe(false);
  });

  it("never offers sold out departures", () => {
    const soldOut = departures.filter((d) => d.salesStatus === "SOLD_OUT");
    expect(soldOut.length).toBeGreaterThan(0);
    expect(soldOut.some(isBookable)).toBe(false);
  });
});
