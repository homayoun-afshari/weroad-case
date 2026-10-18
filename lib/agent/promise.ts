/**
 * A sentence that promises the hand-over before the user has chosen: "I'll connect you with a human
 * agent". "Yes" only ends the chat, and nothing happens until the user answers, so the assistant may
 * offer a person but not promise one.
 */
export function promisesHandOver(answer: string): boolean {
  return [
    /\bI(?:'ll| will)\s+(?:connect|pass|transfer|put|hand|route)\b/i,
    /\bI(?:'m| am)\s+(?:connecting|passing|transferring|handing|putting)\b/i,
    /\blet me\s+(?:connect|pass|transfer|do that|hand|put)\b/i,
  ].some((pattern) => pattern.test(answer));
}

/** What the page says instead when the model promised the connection; the question card follows it. */
export const HAND_OVER_OFFER = "I can offer you a human agent.";
