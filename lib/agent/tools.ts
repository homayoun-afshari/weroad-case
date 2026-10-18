import { tool } from "ai";
import { pageStateBlock } from "@/lib/chat/blocks";
import type { PageState } from "@/lib/page/types";
import { pageStateFor } from "@/lib/page/view";
import { getDepartures } from "@/lib/search/departures";
import { getFaq } from "@/lib/search/faq";
import { getItinerary } from "@/lib/search/itinerary";
import { departuresInputSchema, faqInputSchema, itineraryInputSchema, searchRequestSchema } from "@/lib/search/schema";
import { z } from "zod";

/**
 * A tool that fails must not take the turn down, and must not hand its internals to the model (which
 * may repeat them to the user). The detail goes to the server log; the agent gets a plain message
 * as the tool's error, and tells the user. Nothing it did half-way is kept: a failed `search_trips`
 * leaves the page as it was.
 */
function guarded<Input, Output>(name: string, run: (input: Input) => Output) {
  return (input: Input): Output => {
    try {
      return run(input);
    } catch (error) {
      console.error(`tool ${name} failed`, error);
      throw new Error(`${name} failed: its result is not available right now.`);
    }
  };
}

/** What the tools did to the page during a turn. */
export interface TurnPage {
  /** The page state after the last search of the turn, if there was one. */
  page: PageState | null;
  /** The agent called hand_over: the page will ask the user whether they want a human agent. */
  handOver: boolean;
}

/**
 * The agent's tools. `search_trips` runs the search function inside the tool, in the same step, so
 * the page and the agent's answer come from the same results, and the page follows.
 * `hand_over` only marks that the question should be asked; the page asks it.
 * `get_departures`, `get_itinerary` and `get_faq` only read: the departures and the itinerary of the trips on screen (`onScreen`, in the page's order), and the help-center articles.
 */
export function createTools(turn: TurnPage, onScreen: number[]) {
  return {
    search_trips: tool({
      description:
        "Runs a new search on the page and updates the results list. Send the complete new search request: keep the parts of the current search the user still wants, change what they asked to change, drop what they dropped.",
      inputSchema: searchRequestSchema,
      execute: guarded("search_trips", (request) => {
        const page = pageStateFor(request);
        turn.page = page;
        return pageStateBlock(page);
      }),
    }),
    get_departures: tool({
      description:
        "Gets the departures (dates, price, seats left) of trips on screen, and leaves the page as it is. Use it when the user asks when a trip leaves, what it costs on a date, or what they can book in a date window (\"I only have 19-24 October\"). When the user changes WHAT they want, use search_trips instead. Send from and to for a window, or leave them out for the next departures. Only trips on screen can be asked about.",
      inputSchema: departuresInputSchema,
      execute: guarded("get_departures", (input) => getDepartures({ ...input, onScreen })),
    }),
    get_faq: tool({
      description:
        "Reads WeRoad's help-center articles, and leaves the page as it is. Returns the general articles (payments, deposits, cancelling and refunds, flights, accommodation, rooms, the group, the Travel Group Leader, the \"Open to book\" status) and, when you name a destination, that destination's practical article (one topic per destination: currency, weather, internet and SIM, tipping or plugs). Use it for questions about how things work, not for dates and prices (get_departures) or for changing the search (search_trips). Answer only from the articles returned.",
      inputSchema: faqInputSchema,
      execute: guarded("get_faq", (input) => getFaq(input)),
    }),
    get_itinerary: tool({
      description:
        "Gets the day-by-day plan of one trip on screen (each day's title, where the group sleeps when the data says, and the highlights), and leaves the page as it is. Use it when the user asks what a trip includes or what happens on a day (\"What do we do on day 3 in Iceland?\"). Only trips on screen can be asked about.",
      inputSchema: itineraryInputSchema,
      execute: guarded("get_itinerary", (input) => getItinerary({ ...input, onScreen })),
    }),
    hand_over: tool({
      description:
        "Offers the user a human agent: when the user asks for one, or when you can't answer (a tool doesn't give the answer, or the message is about WeRoad's trips, the page or the help center but no tool covers it). The page then asks the user \"Do you want to connect to a human agent?\" with Yes and No. This ends your turn: write one sentence BEFORE you call it (what you can't answer, or that you can offer a person), and don't ask the question yourself. Not for messages that have nothing to do with WeRoad.",
      inputSchema: z.object({}),
      execute: () => {
        turn.handOver = true;
        return "The page will now ask the user whether they want to connect to a human agent.";
      },
    }),
  };
}
