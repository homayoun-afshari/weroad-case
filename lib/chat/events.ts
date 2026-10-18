import type { PageState, Source } from "@/lib/page/types";
import type { PageEvent } from "./types";

/** The user pressed the search button and the page now shows `page`. */
export function searchEvent(page: PageState): PageEvent {
  return { kind: "search", request: page.request, count: page.results.length };
}

/** The user pressed the undo button: `undone` was on the page, `restored` is on it now. */
export function undoEvent(undone: PageState, restored: PageState, reversed: Source): PageEvent {
  return { kind: "undo", reversed, undone: undone.request, restored: restored.request };
}
