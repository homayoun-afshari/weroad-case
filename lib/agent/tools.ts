import { tool } from "ai";
import { pageStateBlock } from "@/lib/chat/blocks";
import type { PageState } from "@/lib/page/types";
import { pageStateFor } from "@/lib/page/view";
import { searchRequestSchema } from "@/lib/search/schema";

/** What the tools did to the page during a turn. */
export interface TurnPage {
  /** The page state after the last search of the turn, if there was one. */
  page: PageState | null;
}

/**
 * The agent's tools. `search_trips` runs the search function inside the tool, in the same step, so
 * the page and the agent's answer come from the same results, and the page follows.
 */
export function createTools(turn: TurnPage) {
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
  };
}
