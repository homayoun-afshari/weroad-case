import type { ChatEntry } from "./types";

type Answer = "yes" | "no";

/** The question is waiting for the user: the chat stays locked until they answer it. */
export const isAsking = (entries: ChatEntry[]) => entries.some((e) => e.kind === "handover" && e.answer === "asked");

/** The user said yes to a human agent: the chat ends here. */
export const isFrozen = (entries: ChatEntry[]) => entries.some((e) => e.kind === "handover" && e.answer === "yes");

/** Records the user's answer to the question that is waiting. */
export function answerHandOver(entries: ChatEntry[], answer: Answer): ChatEntry[] {
  const index = entries.findIndex((e) => e.kind === "handover" && e.answer === "asked");
  if (index === -1) return entries;
  return entries.map((e, i) => (i === index ? { kind: "handover", answer } : e));
}
