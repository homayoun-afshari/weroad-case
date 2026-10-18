import type { ChatEntry, TurnResponse } from "./types";

/** A chat turn failed; the message is written for the user. */
export class ChatError extends Error {}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/** Asks the server for one turn. The history must end with the user's message. */
export async function postTurn(entries: ChatEntry[], signal?: AbortSignal): Promise<TurnResponse> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ChatError("Couldn't reach the server. Check your connection and try again.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ChatError(body?.error ?? "The assistant couldn't answer. Please try again.");
  }
  return body as TurnResponse;
}
