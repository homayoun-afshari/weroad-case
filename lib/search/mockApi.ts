import { bookableDepartures, trips } from "./catalog";
import { words } from "./text";
import type { Departure, RawSearchResult, SearchState, Trip } from "./types";

/** Every word the trip's text holds: title, destination, trip types, descriptions and itinerary. */
function tripWords(trip: Trip): Set<string> {
  const text = [
    trip.title,
    trip.destination,
    trip.destinationLabel,
    ...trip.travelTypes,
    trip.shortDescription,
    trip.description,
    ...trip.itinerary.flatMap((day) => [day.title, day.nights ?? "", ...day.highlights]),
  ].join(" ");
  return new Set(words(text));
}

const wordsByTrip = new Map(trips.map((trip) => [trip.id, tripWords(trip)]));

function matchesTrip(trip: Trip, state: SearchState): boolean {
  const { destinations, tripTypes, days, physicalRating, text } = state;
  if (destinations.length && !destinations.includes(trip.destination)) return false;
  if (!tripTypes.every((type) => trip.travelTypes.includes(type))) return false;
  if (days?.min !== undefined && trip.numberOfDays < days.min) return false;
  if (days?.max !== undefined && trip.numberOfDays > days.max) return false;
  if (physicalRating && trip.physicalRating !== physicalRating) return false;
  const tripText = wordsByTrip.get(trip.id)!;
  return words(text).every((word) => tripText.has(word));
}

/** All the departure filters must hold on the same departure. */
function matchesDeparture(departure: Departure, state: SearchState): boolean {
  const { dates, maxPrice, ageBand, privateRoom } = state;
  if (dates && (departure.startingDate < dates.from || departure.endingDate > dates.to)) return false;
  if (maxPrice !== undefined && departure.priceEur > maxPrice) return false;
  if (ageBand && departure.ageBand !== ageBand) return false;
  if (privateRoom && !departure.privateRoomBookable) return false;
  return true;
}

/**
 * Our stand-in for WeRoad's Search API: a search state in, the matching trips out in the data's
 * order (ranking is out of scope). A trip matches only through a bookable departure.
 */
export function searchTrips(state: SearchState): RawSearchResult[] {
  const results: RawSearchResult[] = [];
  for (const trip of trips) {
    if (!matchesTrip(trip, state)) continue;
    const departures = bookableDepartures(trip).filter((d) => matchesDeparture(d, state));
    if (!departures.length) continue;
    results.push({ trip, departures, fromPrice: Math.min(...departures.map((d) => d.priceEur)) });
  }
  return results;
}
