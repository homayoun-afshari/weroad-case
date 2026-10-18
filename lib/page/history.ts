import type { SearchRequest } from "@/lib/search/types";
import type { PageHistory, PageState, Source } from "./types";

/** The page opens with a search already applied; it is the user's, and it is the first state to go back to. */
export function createHistory(state: PageState): PageHistory {
  return { entries: [{ state, source: "user" }] };
}

export function current(history: PageHistory): PageState {
  return history.entries[history.entries.length - 1].state;
}

/** The same search, whatever the order of its fields: the search function gives the same page for it. */
export function sameRequest(a: SearchRequest, b: SearchRequest): boolean {
  const canonical = (value: unknown): unknown =>
    value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, canonical(v)]))
      : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Adds a new page state, tagged with who made the change. The same search again is not a change:
 * there would be nothing to go back to, so the history stays as it is.
 */
export function push(history: PageHistory, state: PageState, source: Source): PageHistory {
  if (sameRequest(current(history).request, state.request)) return history;
  return { entries: [...history.entries, { state, source }] };
}

export function canUndo(history: PageHistory): boolean {
  return history.entries.length > 1;
}

/**
 * Restores the previous page state. Also says whose change it reversed, because the brief's metric
 * counts the undos that reverse an assistant change. Null when there is nothing to go back to.
 */
export function undo(history: PageHistory): { history: PageHistory; reversed: Source } | null {
  if (!canUndo(history)) return null;
  const reversed = history.entries[history.entries.length - 1].source;
  return { history: { entries: history.entries.slice(0, -1) }, reversed };
}
