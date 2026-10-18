# Search function

This describes the search function as built, beyond what `SEARCH_FUNCTION.svg` already shows. The figure draws the pipeline, the types that pass between its parts and what changed from the plan, on the left (`DESIGN.md`) and the right (`BUILD.md`). This file holds the rest: why it is built this way, the shared types, and for the function and each of its parts the input, the output, the rules and an example. The code is in `lib/search/`.

**References to the brief.** The brief is the PDF "WeRoad take-home case - The assistant on the search page". It is not in this repository, so a reference is a location, not a link: "_Brief: §3 (p. 2), "Starts from the page"_" means section 3, on page 2, the bullet with that title. Sections 1 and 2 are on page 1, section 3 and the start of section 4 on page 2, and the rest of section 4 on page 3.

**Codes.** The design choices have letters (`DESIGN.md`, section 3): "choice A". The next steps and the suggestions for WeRoad have their own letters (`BUILD.md`, section 5): "next step B", "suggestion A".

## What it is, and why

The search function is **the one place a search happens**. It takes a search request (the content of the search bar and the filters) and returns the search state it understood and the results. Two callers use it and nothing else searches: the search button, through `POST /api/search` with no model call, and the agent's `search_trips` tool (`AGENT_GRAPH.md`), in the same step as the agent's answer. That is how the page and the chat never disagree, and how "the list updates" comes for free: the assistant changes the search request, and the page shows what the function returns, in the same order (choices F and G). _Brief: §3 (p. 2), "Searches like the page does" ("every trip search goes through the same Search API, so chat and page never disagree") and "Drives the page"._

**Why rules, in code, around a mock API.** With an agent-based search every press of the search button would be a model call, and the page would stop working when the model does. Rules are deterministic, testable and free. The trade-off is that rules understand fewer phrasings than a model, and the agent makes up for it in the chat by setting values directly (choice J). _Brief: §2 (p. 1), "'USA', 'northern lights', 'New Year's Eve'… the intent is not mapped"._

**Why a tight mock API.** It assumes only what I know the real Search API does, a search in and an ordered list of trips out. The translator and the suggester sit outside it, so they can be removed when WeRoad's classifier ships or its API suggests (choice H; next step F and suggestion A). _Brief: §1 (p. 1), Search 3.0 and "Smart filters"._

**Why the suggester only runs on an empty result.** The common case is one mock API call and a page that reads like a normal results page (choice I). _Brief: §2 (p. 1), "17% of text searches return nothing"; §3 (p. 2), "Never a dead end"._

The page layer on top of it (`pageStateFor`, `lib/page/view.ts`) turns the output into the **page state** the client holds: the request, the original state and a trimmed view of each result (no itinerary or description), plus the nearest departure when the dates were loosened.

## The types they share

```ts
interface SearchFilters {
  dates?: { from: string; to: string };   // departures lying fully inside (inclusive ISO dates)
  maxPrice?: number;                      // euros
  days?: { min?: number; max?: number };
  ageBand?: "18-25" | "25-35" | "25-49";
  physicalRating?: "LOW" | "MEDIUM" | "HIGH";
  privateRoom?: boolean;
}
interface SearchRequest extends SearchFilters { text: string }      // what the user or the agent sends
interface SearchState extends SearchFilters {                       // what the translator makes of it
  text: string;            // the words left over
  destinations: string[];  // a trip matches if its destination is any of them; empty means any
  tripTypes: string[];     // a trip must have all of them
}
interface RawSearchResult { trip: Trip; departures: Departure[]; fromPrice: number }
interface SearchResult extends RawSearchResult { state: SearchState }   // the state that found it
interface SearchOutput { originalState: SearchState; results: SearchResult[] }
```

## `search(request)`

The function itself. **In:** a `SearchRequest`, validated at the border (`searchRequestSchema`: text at most 200 characters, ISO dates with the start not after the end, a positive price). **Out:** a `SearchOutput`. It is pure and synchronous, and its output survives `JSON.stringify` unchanged, because it travels between the server and the page. It translates the request, asks the mock API, and only when that finds nothing replaces the results with the suggester's; otherwise every result carries the original state.

**Example.** `search({ text: "northern lights", maxPrice: 2000 })`:

```text
originalState: { text: "", maxPrice: 2000, destinations: [], tripTypes: ["Northern Lights"] }
results:       #9 Iceland  from €1,219 (6 departures)   state: originalState
               #11 Sweden  from €1,759 (2 departures)   state: originalState     // Canada, from €2,539, is over the limit
```

## The translator

Plays the role of WeRoad's coming classifier with rules (choice J). **In:** a `SearchRequest`. **Out:** a `SearchState`. _Brief: §1 (p. 1), "Smart filters"; §3 (p. 2), "Searches like the page does" ("the API's classifier extracts the filter values from the text")._

It reads three things from the text and leaves the rest as text:

1. **A max price,** from a phrase: under, below, less than, max, maximum, up to, at most, no more than, within, then a number, with an optional €, "eur" or "euros", and the forms `2,000`, `1.500` and `2k` (the `k` counts only at the end of a word, so "under 2000 kyrgyzstan" still finds Kyrgyzstan).
2. **Destinations,** from the catalog's 50 names, as consecutive words, longest first ("United States", "Puerto Rico", "South Africa"). Several at once are a list ("Peru or Argentina").
3. **Trip types,** from the catalog's 17 names ("northern lights" is the trip type Northern Lights), by their exact name.

What is left is lowercased and unaccented, minus 15 filler words (in, or, and, to, the, trip, trips…). A value set in a filter wins over the same value read from the text. Dates, duration, age band and physical effort come only from the filters, which the agent sets. A request has no destinations field: destinations come only from the text. A place that isn't in the catalog ("Brazil") stays as text and finds nothing, and the agent says there is no trip there. _Brief: §2 (p. 1), "hiking in Brazil or Argentina end of September"._

**Examples.**

```text
translate({ text: "hiking in Argentina under 2000" })
  → { text: "hiking", destinations: ["Argentina"], tripTypes: [], maxPrice: 2000 }

translate({ text: "Peru or Argentina in december", dates: { from: "2026-12-01", to: "2026-12-31" } })
  → { text: "december", dates: { from: "2026-12-01", to: "2026-12-31" }, destinations: ["Argentina", "Peru"], tripTypes: [] }

translate({ text: "hiking in Brazil or Argentina end of September" })
  → { text: "hiking brazil end september", destinations: ["Argentina"], tripTypes: [] }   // Brazil has no trip: it stays text
```

## The mock API

Our stand-in for WeRoad's Search API (choice H). **In:** a `SearchState`. **Out:** a `RawSearchResult[]`, the matching trips in **the data's order**: ranking is out of scope, so the only ranking is the suggester's. _Brief: §1 (p. 1), "understand → retrieve → filter → rank, exposed as one Search API"; §3 (p. 2), "Out of scope: retrieval and ranking changes"._

A trip matches when all of these hold:

- its destination is any of the state's destinations (or the list is empty), and it has all the trip types;
- the duration and the physical rating hold (the rating is an exact match);
- every word of the text is a **whole word** in the trip's title, destination, trip types, descriptions or itinerary ("usa" is not found in "Busan" or "thousand"; "hike" does not find "hiking": there is no stemming);
- **at least one bookable departure** matches the departure filters, and they all hold on the **same departure**: the dates (fully inside the window), the max price, the age band (an exact match) and the private room.

A departure is bookable if it is upcoming (today is 2026-10-16) and its sales status is PLANNED, ALMOST_CONFIRMED, CONFIRMED or ALMOST_FULL, never decided from seats left. `departures` holds the bookable departures that matched, and `fromPrice` the cheapest of them, so the price shown never contradicts the filters. _Brief: §3 (p. 2), "Picks the right tool" ("a trip's departures (dates, status, price, seats left)")._

**Example.** `searchTrips(translate({ text: "northern lights" }))`:

```text
[ { trip: #9 Iceland,  departures: 6 departures, fromPrice: 1219 },
  { trip: #11 Sweden,  departures: 8 departures, fromPrice: 1759 },
  { trip: #41 Canada,  departures: 7 departures, fromPrice: 2539 } ]
```

## The suggester

Turns a search that found nothing into the nearest options, so the page is never empty (choice I). **In:** the original `SearchState`. **Out:** a `SearchResult[]` of at most 10 (`MAX_SUGGESTIONS`), each with **its own** search state, the one that found it. It asks no model. _Brief: §2 (p. 1), "people with fixed dates get a 'no' instead of the nearest option"; §3 (p. 2), "Never a dead end" ("zero results get the nearest options and the reason")._

1. **The values that are set** are loosened in a fixed order: dates, price, duration, age band, physical effort, private room, and then the text as three values, the words, the trip types and the destinations.
2. **One value at a time:** each is dropped alone and the mock API is called. A trip found by two loosenings is listed once, by the first. The results are ordered by the value loosened first, and inside it by the distance from what was asked (the price over the limit, the days outside the window or the duration).
3. **If every single drop is still empty,** the values are dropped together, a growing prefix of the fixed order, until something is found. With all of them dropped, every bookable trip is found, so the search is empty only if no trip can be booked at all.

The calls are bounded: at most one for each value, then one for each prefix.

**Example.** `suggest(translate({ text: "hiking in Argentina under 2000" }))`:

```text
#23 Argentina  from €4,169   state: { destinations: ["Argentina"], text: "hiking" }                  // the price was loosened
#1  Italy      from €719     state: { destinations: [],  maxPrice: 2000, text: "hiking" }            // the destination was loosened
#25 Portugal   from €1,909   (same state)
#31 Croatia, #36 Spain, #45 Nepal …
```

The page compares each result's state with the original one to show the tags ("€4,169 · above your €2,000", "other destination (you asked for Argentina)"), and the agent reads the same fact in the page state ("loosened: max price €2,000"), so the two say the same thing.

## Limits

- Rules understand fewer phrasings than a model: no stemming, trip types by exact name, no aliases ("USA" is written "United States" by the agent, not mapped here).
- The text is matched by whole words, so it narrows by words and not by meaning ("cooking" finds trips 13, 15, 19, 24 and 40, "vegan food" finds nothing; choice M and next step H). _Brief: §3 (p. 2), "Reasons where search cannot"._
- A state holds one set of filters for all its destinations.
- Dates need both ends; at most 10 suggestions; the page state lists at most 10 results.
- Today is a constant (2026-10-16, the date of the data's export), not the clock.
