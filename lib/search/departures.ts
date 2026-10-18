import { isBookable, isUpcoming, trips } from "./catalog";
import type { AgeBand, Departure, SalesStatus } from "./types";

/** Bounds on the answer, so it doesn't weigh on every later turn. */
export const MAX_TRIPS = 10;
export const MAX_DEPARTURES = 5;

/** From the FAQ "What does the 'Open to book' status mean?" (article 7). */
const UNCONFIRMED_NOTE =
  "Not confirmed yet: WeRoad is waiting for a few more bookings. WeRoad's help center says to wait for the departure to be confirmed before buying flights (article 7). Tell the user.";
const WAITING_LIST_NOTE =
  "Waiting list: a seat is not guaranteed, and nothing is known about how the waiting list works. Say so, offer a bookable departure next to it, and leave the choice to the user.";

export interface DepartureView {
  id: string;
  startingDate: string;
  endingDate: string;
  priceEur: number;
  /** The price before the discount, when the departure is discounted. */
  fullPriceEur: number | null;
  /** As the data states it (not maxPax minus paxBooked: the two disagree on most departures). */
  seatsLeft: number;
  status: SalesStatus;
  /** False for PLANNED and ALMOST_CONFIRMED: the user must wait for confirmation before buying flights. */
  confirmed: boolean;
  ageBand: AgeBand;
  privateRoomBookable: boolean;
}

/** A departure that doesn't fit the window, and how far it sticks out. */
export interface OutsideWindow extends DepartureView {
  how: string;
}

export interface TripDepartures {
  tripId: number;
  destination: string;
  title: string;
  /** Bookable departures, by date: inside the window, or the next ones when there is no window. */
  departures: DepartureView[];
  /** How many more there are than shown. */
  omitted: number;
  waitingList: DepartureView[];
  /** The nearest bookable departures outside the window, only when no trip on screen fits it. */
  nearestBefore: OutsideWindow | null;
  nearestAfter: OutsideWindow | null;
}

export interface DeparturesResult {
  window: { from: string; to: string } | null;
  trips: TripDepartures[];
  /** Requested trips that are not on the page. */
  notOnScreen: number[];
  /** How many trips are on the page, and how many of them this answer covers. */
  tripsOnScreen: number;
  tripsChecked: number;
  noTripFitsWindow: boolean;
  notes: string[];
}

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const plural = (count: number) => `${count} day${count === 1 ? "" : "s"}`;

function view(d: Departure): DepartureView {
  return {
    id: d.id,
    startingDate: d.startingDate,
    endingDate: d.endingDate,
    priceEur: d.priceEur,
    fullPriceEur: d.basePriceEur,
    seatsLeft: d.seatsLeft,
    status: d.salesStatus,
    confirmed: d.salesStatus !== "PLANNED" && d.salesStatus !== "ALMOST_CONFIRMED",
    ageBand: d.ageBand,
    privateRoomBookable: d.privateRoomBookable,
  };
}

const inside = (d: Departure, w: { from: string; to: string }) => d.startingDate >= w.from && d.endingDate <= w.to;

/**
 * How many days a departure sticks out of a window: 0 when it lies inside it; else the days it
 * starts before the window opens, the days it starts after the window ends, or (when it starts
 * inside and ends after) the days it ends after the window ends.
 */
export function outsideBy(d: Departure, w: { from: string; to: string }): number {
  if (inside(d, w)) return 0;
  if (d.startingDate < w.from) return days(d.startingDate, w.from);
  return d.startingDate > w.to ? days(w.to, d.startingDate) : days(w.to, d.endingDate);
}

/** The bookable departure that sticks out of the window the least on one side. */
function nearest(candidates: Departure[], w: { from: string; to: string }, side: "before" | "after"): OutsideWindow | null {
  const scored = candidates.map((d) => {
    const n = outsideBy(d, w);
    if (side === "before") return { d, n, how: `starts ${plural(n)} before the window opens` };
    // After: it starts after the window ends, or starts inside it and ends after it
    return { d, n, how: `${d.startingDate > w.to ? "starts" : "ends"} ${plural(n)} after the window ends` };
  });
  scored.sort((a, b) => a.n - b.n);
  return scored[0] ? { ...view(scored[0].d), how: scored[0].how } : null;
}

/**
 * Departures of trips on screen. The rules are here, not in the prompt: only upcoming, bookable
 * departures are offered; a window matches departures fully inside it; when no trip on screen has
 * one, the nearest bookable departures before and after come with how far they are; waiting-list
 * departures are listed apart, never as bookable.
 */
export function getDepartures(options: {
  /** The trips asked about; all the trips on screen (the first ones) when left out. */
  tripIds?: number[];
  from?: string;
  to?: string;
  /** The ids of the trips on the page, in the page's order. */
  onScreen: number[];
}): DeparturesResult {
  const { onScreen } = options;
  const window = options.from && options.to ? { from: options.from, to: options.to } : null;
  const asked = options.tripIds ?? onScreen;
  const notOnScreen = asked.filter((id) => !onScreen.includes(id));
  const chosen = asked.filter((id) => onScreen.includes(id)).slice(0, MAX_TRIPS);

  const rows = chosen.map((id) => {
    const trip = trips.find((t) => t.id === id)!;
    const bookable = trip.tours.filter(isBookable);
    const fits = window ? bookable.filter((d) => inside(d, window)) : bookable;
    const waiting = trip.tours.filter((d) => isUpcoming(d) && d.salesStatus === "WAITING_LIST");
    return { trip, bookable, fits, waiting: window ? waiting.filter((d) => inside(d, window)) : waiting };
  });

  const noTripFitsWindow = window !== null && rows.every((r) => r.fits.length === 0);

  const result: TripDepartures[] = rows.map(({ trip, bookable, fits, waiting }) => {
    const outside = bookable.filter((d) => !fits.includes(d));
    return {
      tripId: trip.id,
      destination: trip.destination,
      title: trip.title,
      departures: fits.slice(0, MAX_DEPARTURES).map(view),
      omitted: Math.max(0, fits.length - MAX_DEPARTURES),
      waitingList: waiting.map(view),
      nearestBefore: noTripFitsWindow ? nearest(outside.filter((d) => d.startingDate < window!.from), window!, "before") : null,
      nearestAfter: noTripFitsWindow ? nearest(outside.filter((d) => d.startingDate >= window!.from), window!, "after") : null,
    };
  });

  const shown = result.flatMap((r) => [...r.departures, ...r.waitingList, r.nearestBefore, r.nearestAfter]).filter(Boolean);
  const notes: string[] = [];
  if (shown.some((d) => d!.confirmed === false)) notes.push(UNCONFIRMED_NOTE);
  if (result.some((r) => r.waitingList.length > 0)) notes.push(WAITING_LIST_NOTE);
  // Asked about all the trips on screen, but only the first ones fit in the answer: say so
  if (!options.tripIds && onScreen.length > chosen.length) {
    notes.push(`Only the first ${chosen.length} of the ${onScreen.length} trips on screen were checked, in the page's order.`);
  }

  return { window, trips: result, notOnScreen, tripsOnScreen: onScreen.length, tripsChecked: chosen.length, noTripFitsWindow, notes };
}
