import faqsFile from "@/data/weroad-tech-case-faqs.json";
import tripsFile from "@/data/weroad-tech-case-trips-and-departures.json";
import type { Departure, Faq, SalesStatus, Trip } from "./types";

export const trips = tripsFile.travels as Trip[];
export const faqs = faqsFile.faqs as Faq[];

/** The data was exported on this date; every "past" and "upcoming" is measured from it. */
export const TODAY = "2026-10-16";

/** Statuses a departure can be booked on. PLANNED and ALMOST_CONFIRMED are not confirmed yet. */
const BOOKABLE_STATUSES: ReadonlySet<SalesStatus> = new Set([
  "PLANNED",
  "ALMOST_CONFIRMED",
  "CONFIRMED",
  "ALMOST_FULL",
]);

export function isUpcoming(departure: Departure): boolean {
  return departure.startingDate >= TODAY;
}

/** Bookability comes from the sales status, never from seats left (129 NOT_AVAILABLE departures show seats). */
export function isBookable(departure: Departure): boolean {
  return isUpcoming(departure) && BOOKABLE_STATUSES.has(departure.salesStatus);
}

/** A seat is not guaranteed: it is shown next to a bookable alternative, never as bookable. */
export function isWaitingList(departure: Departure): boolean {
  return isUpcoming(departure) && departure.salesStatus === "WAITING_LIST";
}

export function bookableDepartures(trip: Trip): Departure[] {
  return trip.tours.filter(isBookable);
}

/** The price shown for a trip: its cheapest bookable departure. */
export function fromPrice(trip: Trip): number | null {
  const prices = bookableDepartures(trip).map((d) => d.priceEur);
  return prices.length ? Math.min(...prices) : null;
}

/** Destination names in the catalog, longest first so a longer name wins over a shorter one it contains. */
export const destinations = [...new Set(trips.map((t) => t.destination))].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);
