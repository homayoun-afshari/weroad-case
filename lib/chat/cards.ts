import { describeRequest, plural } from "./blocks";
import type { PageEvent } from "./types";

/** One line of a page changes card, in the user's voice: the same facts as the model's `<page_events>` line. */
export function cardLine(event: PageEvent): string {
  if (event.kind === "search") {
    const trips = event.suggested
      ? `no exact matches, ${plural(event.count, "closest option")}`
      : event.count === 0
        ? "no trips"
        : plural(event.count, "trip");
    return `You searched ${describeRequest(event.request)} → ${trips}`;
  }
  if (event.kind === "controls") {
    return event.draft
      ? `You changed the controls (not searched yet): ${describeRequest(event.draft)}`
      : "You put the controls back to the page's search";
  }
  const whose = event.reversed === "assistant" ? "the assistant's change" : "your own change";
  return `You undid ${whose} (${describeRequest(event.undone)}), back to ${describeRequest(event.restored)}`;
}
