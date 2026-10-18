import { loosenedKeys } from "@/lib/search/loosening";
import type { PageState } from "./types";

/** The results are the nearest options: each was found by a search state that loosened what was asked. */
export const isSuggested = (page: PageState) =>
  page.results.some((result) => loosenedKeys(page.originalState, result.state).length > 0);
