import { tool } from "ai";
import { pageStateBlock } from "@/lib/chat/blocks";
import type { PageState } from "@/lib/page/types";
import { pageStateFor } from "@/lib/page/view";
import { getDepartures } from "@/lib/search/departures";
import { departuresInputSchema, searchRequestSchema } from "@/lib/search/schema";

/** What the tools did to the page during a turn. */
export interface TurnPage {
  /** The page state after the last search of the turn, if there was one. */
  page: PageState | null;
}

/**
 * The agent's tools. `search_trips` runs the search function inside the tool, in the same step, so
 * the page and the agent's answer come from the same results, and the page follows.
 * `get_departures` only reads: the departures of the trips on screen (`onScreen`, in the page's order).
 */
export function createTools(turn: TurnPage, onScreen: number[]) {
  return {
    search_trips: tool({
      description:
        "Runs a new search on the page and updates the results list. Send the complete new search request: keep the parts of the current search the user still wants, change what they asked to change, drop what they dropped.",
      inputSchema: searchRequestSchema,
      execute: (request) => {
        turn.page = pageStateFor(request);
        return pageStateBlock(turn.page);
      },
    }),
    get_departures: tool({
      description:
        "Gets the departures (dates, price, seats left) of trips on screen, and leaves the page as it is. Use it when the user asks when a trip leaves, what it costs on a date, or what they can book in a date window (\"I only have 19-24 October\"). When the user changes WHAT they want, use search_trips instead. Send from and to for a window, or leave them out for the next departures. Only trips on screen can be asked about.",
      inputSchema: departuresInputSchema,
      execute: (input) => getDepartures({ ...input, onScreen }),
    }),
  };
}
