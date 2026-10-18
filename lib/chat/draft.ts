/** Shown in the message box when a search runs while the chat input holds a message that wasn't sent. */
export const DRAFT_WARNING = {
  title: "Your chat message wasn't sent",
  body: "Press send to ask the assistant.",
};

/**
 * Whether a search left a chat message behind. Only a message that could be sent counts: a locked
 * input (a turn is running, a question waits, the chat has ended) can't be sent by pressing send.
 */
export const hasUnsentDraft = (draft: string, canSend: boolean) => canSend && draft.trim() !== "";
