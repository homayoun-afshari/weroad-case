import type { PageHistory, PageState, Source } from "./types";

/** The page opens with a search already applied; it is the user's, and it is the first state to go back to. */
export function createHistory(state: PageState): PageHistory {
  return { entries: [{ state, source: "user" }] };
}

export function current(history: PageHistory): PageState {
  return history.entries[history.entries.length - 1].state;
}

/** Adds a new page state, tagged with who made the change. */
export function push(history: PageHistory, state: PageState, source: Source): PageHistory {
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
