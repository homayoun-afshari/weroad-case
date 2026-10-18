import { describe, expect, it } from "vitest";
import { answerHandOver, isAsking, isFrozen } from "@/lib/chat/handover";
import { addUserMessage, toModelMessages } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";

const page = pageStateFor({ text: "northern lights" });
const asked: ChatEntry[] = [
  { kind: "assistant", text: "Hi." },
  { kind: "assistant", text: "I don't have information about visas." },
  { kind: "handover", answer: "asked" },
];

describe("the hand-over question", () => {
  it("waits for an answer, and the chat is not closed while it does", () => {
    expect(isAsking(asked)).toBe(true);
    expect(isFrozen(asked)).toBe(false);
  });

  it("closes the chat when the user says yes", () => {
    const entries = answerHandOver(asked, "yes");
    expect(entries.at(-1)).toEqual({ kind: "handover", answer: "yes" });
    expect(isFrozen(entries)).toBe(true);
    expect(isAsking(entries)).toBe(false);
  });

  it("closes only the question when the user says no", () => {
    const entries = answerHandOver(asked, "no");
    expect(entries.at(-1)).toEqual({ kind: "handover", answer: "no" });
    expect(isFrozen(entries)).toBe(false);
    expect(isAsking(entries)).toBe(false);
  });

  it("answers the question that waits, and leaves the other entries alone", () => {
    const entries = answerHandOver(asked, "no");
    expect(entries.slice(0, 2)).toEqual(asked.slice(0, 2));
  });

  it("does nothing when no question waits", () => {
    const entries = answerHandOver(asked, "no");
    expect(answerHandOver(entries, "yes")).toBe(entries);
    expect(isFrozen(answerHandOver(entries, "yes"))).toBe(false);
  });

  it("can be asked again later, after a no", () => {
    const again = [...answerHandOver(asked, "no"), { kind: "handover", answer: "asked" } as ChatEntry];
    expect(isAsking(again)).toBe(true);
  });
});

describe("what the model reads of it", () => {
  const userFirst: ChatEntry[] = addUserMessage([{ kind: "assistant", text: "Hi." }], "Do I need a visa?", page);

  it("does not read the question while it waits, nor a yes", () => {
    for (const answer of ["asked", "yes"] as const) {
      const entries: ChatEntry[] = [...userFirst, { kind: "assistant", text: "I don't know." }, { kind: "handover", answer }];
      expect(toModelMessages(entries).map((m) => m.role)).toEqual(["user", "assistant"]);
    }
  });

  it("reads a no as the user declining, so the agent doesn't offer again", () => {
    const entries: ChatEntry[] = [...userFirst, { kind: "assistant", text: "I don't know." }, { kind: "handover", answer: "no" }];
    const messages = toModelMessages(entries);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[2].content).toBe("No, thank you. I don't want to connect to a human agent.");
  });
});
