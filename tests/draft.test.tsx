import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageBox } from "@/components/MessageBox";
import { DRAFT_WARNING, hasUnsentDraft } from "@/lib/chat/draft";

describe("a chat message left unsent by a search", () => {
  it("is one that could be sent", () => {
    expect(hasUnsentDraft("what about Sweden?", true)).toBe(true);
  });

  it("is not an empty message, or one of only spaces", () => {
    expect(hasUnsentDraft("", true)).toBe(false);
    expect(hasUnsentDraft("   \n ", true)).toBe(false);
  });

  it("is not a message in an input that is locked: send can't be pressed there", () => {
    expect(hasUnsentDraft("what about Sweden?", false)).toBe(false);
  });

  it("is warned about in the words of the design", () => {
    expect(DRAFT_WARNING).toEqual({
      title: "Your chat message wasn't sent",
      body: "Press send to ask the assistant.",
    });
  });
});

describe("the message box", () => {
  it("shows an error by default", () => {
    const markup = renderToStaticMarkup(<MessageBox notice={{ title: "Search failed", body: "Try again." }} onClose={() => {}} />);
    expect(markup).toContain('class="message-box"');
    expect(markup).not.toContain("warning");
  });

  it("shows the draft warning with its own look: a warning, not an error", () => {
    const markup = renderToStaticMarkup(<MessageBox notice={{ ...DRAFT_WARNING, kind: "warning" }} onClose={() => {}} />);
    expect(markup).toContain('class="message-box warning"');
    expect(markup).toContain("Your chat message wasn&#x27;t sent");
    expect(markup).toContain("Press send to ask the assistant.");
    expect(markup).toContain('role="alert"');
  });
});
