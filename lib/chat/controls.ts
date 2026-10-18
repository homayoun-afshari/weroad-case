import type { SearchRequest } from "@/lib/search/types";
import type { ChatEntry, PageEvent } from "./types";

const isControls = (event: PageEvent) => event.kind === "controls";

/**
 * Sets the control event of the live card (the page card at the end of the history): only the last
 * state of the controls is kept, so any earlier control event of the card is replaced.
 *
 * - `draft`: the controls describe a request that hasn't been searched.
 * - `null`: the controls match the page's search. When the agent was told of a draft (`reported`) the
 *   card says the controls are back, so it doesn't believe the draft still exists; otherwise the
 *   event just goes away. Pressing search or undo also use this to consume the draft.
 */
export function setDraft(entries: ChatEntry[], draft: SearchRequest | null, reported: boolean): ChatEntry[] {
  const last = entries[entries.length - 1];
  const kept = last?.kind === "page" ? last.events.filter((e) => !isControls(e)) : [];
  const before = last?.kind === "page" ? entries.slice(0, -1) : entries;

  const events: PageEvent[] = [...kept];
  if (draft) events.push({ kind: "controls", draft });
  else if (reported) events.push({ kind: "controls", draft: null });

  return events.length ? [...before, { kind: "page", events }] : before;
}

/** Whether the agent's last word on the controls is a draft, once the user's next message is sent. */
export function reportedAfterSend(entries: ChatEntry[], reported: boolean): boolean {
  const last = entries[entries.length - 1];
  const event = last?.kind === "page" ? last.events.find(isControls) : undefined;
  return event?.kind === "controls" ? event.draft !== null : reported;
}
