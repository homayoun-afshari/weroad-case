import { describe, expect, it } from "vitest";
import { describeEvent, pageBlocks } from "@/lib/chat/blocks";
import { cardLine } from "@/lib/chat/cards";
import { reportedAfterSend, setDraft } from "@/lib/chat/controls";
import { searchEvent } from "@/lib/chat/events";
import { addUserMessage, toModelMessages } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { formToRequest, isDirty, requestToForm, sameRequest } from "@/lib/page/form";
import { pageStateFor } from "@/lib/page/view";
import type { SearchRequest } from "@/lib/search/types";

const hello: ChatEntry = { kind: "assistant", text: "Hi." };
const d1500: SearchRequest = { text: "northern lights", maxPrice: 1500 };
const d1800: SearchRequest = { text: "northern lights", maxPrice: 1800 };

describe("the control event of the live card", () => {
  it("starts a card for a draft", () => {
    expect(setDraft([hello], d1500, false)).toEqual([hello, { kind: "page", events: [{ kind: "controls", draft: d1500 }] }]);
  });

  it("keeps only the last state of the controls", () => {
    let entries = setDraft([hello], d1500, false);
    entries = setDraft(entries, d1800, false);
    expect(entries).toEqual([hello, { kind: "page", events: [{ kind: "controls", draft: d1800 }] }]);
  });

  it("goes away when the controls match the page again and the agent wasn't told of a draft", () => {
    const entries = setDraft(setDraft([hello], d1500, false), null, false);
    expect(entries).toEqual([hello]);
  });

  it("says the controls are back when the agent was told of a draft", () => {
    const entries = setDraft(setDraft([hello], d1500, true), null, true);
    expect(entries).toEqual([hello, { kind: "page", events: [{ kind: "controls", draft: null }] }]);
  });

  it("replaces the 'back' event when the user edits again", () => {
    const entries = setDraft(setDraft([hello], null, true), d1800, true);
    expect(entries).toEqual([hello, { kind: "page", events: [{ kind: "controls", draft: d1800 }] }]);
  });

  it("leaves the other events of the card alone", () => {
    const search = searchEvent(pageStateFor({ text: "iceland" }));
    const entries: ChatEntry[] = [hello, { kind: "page", events: [search] }];
    expect(setDraft(entries, d1500, false)[1]).toEqual({ kind: "page", events: [search, { kind: "controls", draft: d1500 }] });
    expect(setDraft(setDraft(entries, d1500, false), null, false)).toEqual(entries);
  });

  it("never touches a card that already went with a message", () => {
    const frozen: ChatEntry[] = [hello, { kind: "page", events: [{ kind: "controls", draft: d1500 }] }];
    const sent = addUserMessage(frozen, "ok", pageStateFor({ text: "northern lights" }));
    const next = setDraft([...sent, { kind: "assistant", text: "Sure." }], d1800, true);
    expect(next.slice(0, sent.length)).toEqual(sent);
    expect(next.at(-1)).toEqual({ kind: "page", events: [{ kind: "controls", draft: d1800 }] });
  });
});

describe("what the agent was last told about the controls", () => {
  it("is a draft once a message is sent with one", () => {
    expect(reportedAfterSend(setDraft([hello], d1500, false), false)).toBe(true);
  });

  it("is no draft once a message is sent with the controls back", () => {
    expect(reportedAfterSend(setDraft([hello], null, true), true)).toBe(false);
  });

  it("stays as it was when the live card has no control event", () => {
    expect(reportedAfterSend([hello], true)).toBe(true);
    expect(reportedAfterSend([hello], false)).toBe(false);
    expect(reportedAfterSend([], false)).toBe(false);
  });
});

describe("the third page event, in words", () => {
  it("tells the user what they changed, and what they put back", () => {
    expect(cardLine({ kind: "controls", draft: d1500 })).toBe(
      'You changed the controls (not searched yet): "northern lights" · max price €1,500',
    );
    expect(cardLine({ kind: "controls", draft: null })).toBe("You put the controls back to the page's search");
  });

  it("tells the model the same, and that the page still shows the search", () => {
    expect(describeEvent({ kind: "controls", draft: d1500 })).toBe(
      'user changed the controls but has not searched yet: "northern lights" · max price €1,500',
    );
    expect(describeEvent({ kind: "controls", draft: null })).toBe("user put the controls back to the page's search");
  });

  it("goes into the page events of the next message, before the page state that still shows the search", () => {
    const page = pageStateFor({ text: "northern lights" });
    const blocks = pageBlocks([{ kind: "controls", draft: d1500 }], page);
    expect(blocks.split("\n").slice(0, 4)).toEqual([
      "<page_events>",
      'user changed the controls but has not searched yet: "northern lights" · max price €1,500',
      "</page_events>",
      "<page_state>",
    ]);
    expect(blocks).toContain('search: "northern lights" · dates: none');
  });

  it("reaches the model through the user message after the card", () => {
    const page = pageStateFor({ text: "northern lights" });
    const entries = addUserMessage(setDraft([hello], d1500, false), "ok, search that", page);
    const [message] = toModelMessages(entries);
    expect(JSON.stringify(message)).toContain("has not searched yet");
    expect(JSON.stringify(message)).toContain("ok, search that");
  });
});

describe("when the controls differ from the page", () => {
  const page: SearchRequest = { text: "northern lights", maxPrice: 1500 };

  it("is not the case right after the page's request fills the controls", () => {
    expect(isDirty(requestToForm(page), page)).toBe(false);
  });

  it("is the case after any change", () => {
    const form = requestToForm(page);
    expect(isDirty({ ...form, maxPrice: "1800" }, page)).toBe(true);
    expect(isDirty({ ...form, text: "iceland" }, page)).toBe(true);
    expect(isDirty({ ...form, privateRoom: true }, page)).toBe(true);
    expect(isDirty({ ...form, dateFrom: "2026-12-01", dateTo: "2026-12-08" }, page)).toBe(true);
  });

  it("ignores differences that don't change the search", () => {
    const form = requestToForm(page);
    expect(isDirty({ ...form, text: " northern lights " }, page)).toBe(false);
    // requests the agent may send: an empty duration, a private room set to false, keys in another order
    expect(sameRequest({ text: "x", days: {} }, { text: "x" })).toBe(true);
    expect(isDirty(requestToForm({ text: "x" }), { text: "x", days: {} })).toBe(false);
    expect(isDirty(requestToForm({ text: "x" }), { text: "x", privateRoom: false })).toBe(false);
    expect(sameRequest({ text: "x", maxPrice: 5, ageBand: "25-35" }, { ageBand: "25-35", maxPrice: 5, text: "x" })).toBe(true);
  });

  it("sees a different duration or window", () => {
    expect(sameRequest({ text: "x", days: { min: 3 } }, { text: "x", days: { max: 3 } })).toBe(false);
    expect(
      sameRequest({ text: "x", dates: { from: "2026-12-01", to: "2026-12-08" } }, { text: "x", dates: { from: "2026-12-01", to: "2026-12-09" } }),
    ).toBe(false);
  });

  it("builds the draft from the controls", () => {
    expect(formToRequest({ ...requestToForm(page), maxPrice: "1000" })).toEqual({ text: "northern lights", maxPrice: 1000 });
  });
});
