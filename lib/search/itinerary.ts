import { trips } from "./catalog";

export interface ItineraryResult {
  tripId: number;
  /** False when the trip is not on the page: nothing else is returned for it. */
  onScreen: boolean;
  destination?: string;
  title?: string;
  numberOfDays?: number;
  /** Each day's title, where the group sleeps (null when the data doesn't say) and its highlights. */
  days: { day: number; title: string; nights: string | null; highlights: string[] }[];
  notes: string[];
}

/** The day-by-day plan of a trip on screen, as the data has it. */
export function getItinerary(options: { tripId: number; onScreen: number[] }): ItineraryResult {
  const { tripId, onScreen } = options;
  const trip = onScreen.includes(tripId) ? trips.find((t) => t.id === tripId) : undefined;
  if (!trip) return { tripId, onScreen: false, days: [], notes: [`Trip ${tripId} is not on the page.`] };

  const notes: string[] = [];
  // 11 of the 50 itineraries are one day short of the trip's length
  if (trip.itinerary.length < trip.numberOfDays) {
    notes.push(`The itinerary lists ${trip.itinerary.length} of the trip's ${trip.numberOfDays} days.`);
  }
  return {
    tripId,
    onScreen: true,
    destination: trip.destination,
    title: trip.title,
    numberOfDays: trip.numberOfDays,
    days: trip.itinerary.map(({ day, title, nights, highlights }) => ({ day, title, nights: nights || null, highlights })),
    notes,
  };
}
