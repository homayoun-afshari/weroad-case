import { isSuggested } from "@/lib/page/suggested";
import type { SearchRequest } from "@/lib/search/types";
import type { Observation } from "./engine";

/**
 * The live cases: conversations with the real model, built from the data's traps and from what went
 * wrong in live runs. Each turn says which tools must be called, whether the page changes, and what
 * the new search must look like. The checks on what is written (prices and dates, FAQ answers, the
 * promise of a hand-over) are applied to every turn by the engine.
 */

/** The tools a turn must call: exactly these, all of these (and maybe more), or at least one of these. */
export type ToolSpec = { exactly: string[] } | { includes: string[] } | { anyOf: string[] };

export interface TurnSpec {
  say: string;
  tools: ToolSpec;
  page?: "unchanged" | "changed";
  /** Checks on the new search, the results or the answer; each failure is a line. */
  check?: (observation: Observation) => string[];
  /** The help-center case this answer is also checked against (see faqCases.ts). */
  faq?: string;
  /** The answer is printed for a hand review (the kinds of error with no check). */
  review?: boolean;
}

export interface EvalCase {
  id: string;
  /** The search the page opens with. */
  opening: SearchRequest;
  turns: TurnSpec[];
}

const NORTHERN: SearchRequest = { text: "northern lights" };
const ids = (o: Observation) => o.page?.results.map((r) => r.tripId) ?? [];
const request = (o: Observation) => o.page?.request;
const SAYS_NO_EXACT_MATCH =
  /no exact|nothing matches|doesn't match|does not match|not an exact|no (?:\w+\s+)?trips?\s+match|none (?:of them )?match|(?:didn't|did not|couldn't|could not) find an exact/i;

export const CASES: EvalCase[] = [
  // The tool to use for what the user wants
  { id: "departures-window", opening: NORTHERN, turns: [{ say: "I only have 19-24 October", tools: { exactly: ["get_departures"] }, page: "unchanged" }] },
  { id: "departures-trip-month", opening: NORTHERN, turns: [{ say: "When does the Iceland one leave in December?", tools: { exactly: ["get_departures"] }, page: "unchanged" }] },
  { id: "departures-seats", opening: NORTHERN, turns: [{ say: "How many seats are left on the Sweden one?", tools: { exactly: ["get_departures"] }, page: "unchanged" }] },
  {
    id: "cheaper",
    opening: NORTHERN,
    turns: [
      {
        say: "Something cheaper, max 1,500",
        tools: { exactly: ["search_trips"] },
        page: "changed",
        check: (o) => [
          ...(request(o)?.maxPrice === 1500 ? [] : [`max price is ${request(o)?.maxPrice}, not 1500`]),
          ...(/northern/i.test(request(o)?.text ?? "") ? [] : ["dropped the northern lights, which the user kept"]),
        ],
      },
    ],
  },
  {
    id: "forget-and-dates",
    opening: NORTHERN,
    turns: [
      {
        say: "Forget the northern lights, anything on 19-24 October",
        tools: { exactly: ["search_trips"] },
        page: "changed",
        check: (o) => [
          ...(request(o)?.dates?.from === "2026-10-19" && request(o)?.dates?.to === "2026-10-24" ? [] : [`dates are ${JSON.stringify(request(o)?.dates)}`]),
          ...(/northern/i.test(request(o)?.text ?? "") ? ["kept the northern lights, which the user dropped"] : []),
        ],
      },
    ],
  },
  { id: "itinerary", opening: NORTHERN, turns: [{ say: "What do we do on day 3 in Iceland?", tools: { exactly: ["get_itinerary"] }, page: "unchanged" }] },
  { id: "human", opening: NORTHERN, turns: [{ say: "I want to talk to a person", tools: { exactly: ["hand_over"] }, page: "unchanged" }] },
  {
    id: "off-topic",
    opening: NORTHERN,
    turns: [{ say: "What's the capital of France?", tools: { exactly: [] }, page: "unchanged", check: (o) => (o.handOver ? ["offered a human agent for something that has nothing to do with WeRoad"] : []) }],
  },

  // The help center: grounded answers, and "I don't know" where no article covers it
  { id: "faq-weather", opening: NORTHERN, turns: [{ say: "What's the weather like in Iceland?", tools: { includes: ["get_faq"] }, page: "unchanged", faq: "weather-iceland" }] },
  { id: "faq-cancel", opening: NORTHERN, turns: [{ say: "Can I cancel my booking?", tools: { includes: ["get_faq"] }, page: "unchanged", faq: "cancel" }] },
  { id: "faq-visa", opening: NORTHERN, turns: [{ say: "Do I need a visa?", tools: { includes: ["get_faq", "hand_over"] }, page: "unchanged", faq: "visa" }] },
  { id: "faq-plugs", opening: NORTHERN, turns: [{ say: "What are the plugs like in Iceland?", tools: { includes: ["get_faq"] }, page: "unchanged", faq: "plugs-iceland" }] },
  { id: "faq-currency", opening: NORTHERN, turns: [{ say: "What's the currency in Sweden?", tools: { includes: ["get_faq"] }, page: "unchanged", faq: "currency-sweden" }] },
  { id: "faq-unconfirmed", opening: NORTHERN, turns: [{ say: "What happens if I book an unconfirmed departure? Do I have to pay?", tools: { includes: ["get_faq"] }, page: "unchanged", faq: "unconfirmed-deposit" }] },

  // The traps of the brief
  {
    id: "usa",
    opening: NORTHERN,
    turns: [{ say: "I'd like to go to the USA", tools: { includes: ["search_trips"] }, page: "changed", check: (o) => (ids(o).includes(22) ? [] : [`New York (22) is not in the results: ${ids(o).join(", ")}`]) }],
  },
  {
    id: "brazil-argentina",
    opening: NORTHERN,
    turns: [
      {
        say: "hiking in Brazil or Argentina end of September",
        tools: { includes: ["search_trips"] },
        page: "changed",
        review: true,
        check: (o) => [...(ids(o).includes(23) ? [] : ["Patagonia (23) is not in the results"]), ...(SAYS_NO_EXACT_MATCH.test(o.answer) ? [] : ["doesn't say nothing matches exactly"])],
      },
    ],
  },
  {
    id: "new-years-eve",
    opening: NORTHERN,
    turns: [
      {
        // Either is defensible: look at all trips (a search), or at when the trips on screen leave (departures)
        say: "Anything for New Year's Eve?",
        tools: { anyOf: ["search_trips", "get_departures"] },
        check: (o) => {
          if (!o.page) return [];
          const dates = request(o)?.dates;
          return dates && dates.from <= "2026-12-31" && dates.to >= "2027-01-01" ? [] : [`dates ${JSON.stringify(dates)} don't cover the night of 31 December`];
        },
      },
    ],
  },
  {
    id: "narrow-cooking",
    opening: { text: "" },
    turns: [
      {
        say: "Only the ones with a cooking class",
        tools: { includes: ["search_trips"] },
        page: "changed",
        check: (o) => [
          ...(/cooking/i.test(request(o)?.text ?? "") ? [] : ["the search doesn't ask for cooking"]),
          ...(ids(o).length > 0 && ids(o).every((id) => [13, 15, 19, 24, 40].includes(id)) ? [] : [`results are ${ids(o).join(", ")}`]),
        ],
      },
    ],
  },
  {
    id: "any-period",
    opening: { text: "", dates: { from: "2026-12-01", to: "2026-12-31" } },
    turns: [
      {
        say: "ok, any period, but max 2,000",
        tools: { includes: ["search_trips"] },
        page: "changed",
        check: (o) => [...(request(o)?.dates === undefined ? [] : ["kept the dates"]), ...(request(o)?.maxPrice === 2000 ? [] : [`max price is ${request(o)?.maxPrice}`])],
      },
    ],
  },

  // A search that finds nothing exactly: the nearest options, and what the agent says about them
  {
    id: "suggestions-argentina",
    opening: NORTHERN,
    turns: [
      {
        say: "hiking in Argentina under 2000",
        tools: { includes: ["search_trips"] },
        page: "changed",
        review: true,
        check: (o) => [...(o.page && isSuggested(o.page) ? [] : ["the results are not suggestions"]), ...(SAYS_NO_EXACT_MATCH.test(o.answer) ? [] : ["doesn't say nothing matches exactly"])],
      },
    ],
  },
  {
    id: "suggestions-japan",
    opening: NORTHERN,
    turns: [
      {
        say: "Japan under 800",
        tools: { includes: ["search_trips"] },
        page: "changed",
        review: true,
        check: (o) => [...(o.page && isSuggested(o.page) ? [] : ["the results are not suggestions"]), ...(SAYS_NO_EXACT_MATCH.test(o.answer) ? [] : ["doesn't say nothing matches exactly"])],
      },
    ],
  },

  // Two turns: nothing fits the dates, the agent offers to look at all trips, the user says yes
  {
    id: "offer-then-yes",
    opening: NORTHERN,
    turns: [
      { say: "I only have 19-24 October", tools: { exactly: ["get_departures"] }, page: "unchanged" },
      {
        say: "yes please, show me all trips for those dates",
        tools: { includes: ["search_trips"] },
        page: "changed",
        review: true,
        check: (o) => (request(o)?.dates?.from === "2026-10-19" && request(o)?.dates?.to === "2026-10-24" ? [] : [`dates are ${JSON.stringify(request(o)?.dates)}`]),
      },
    ],
  },
];
