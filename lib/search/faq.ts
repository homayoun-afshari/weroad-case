import { destinations, faqs } from "./catalog";
import { words } from "./text";
import type { Faq } from "./types";

export interface FaqResult {
  /** The destination asked about, as given; null when none was. */
  destination: string | null;
  /** The destination's article first, then the general ones. Verbatim from the data. */
  articles: Pick<Faq, "id" | "scope" | "destination" | "title" | "body">[];
  notes: string[];
}

const same = (a: string, b: string) => words(a).join(" ") === words(b).join(" ");

/**
 * Our small retrieval for the FAQs (the in-house RAG): the general articles plus the article of the
 * destination asked about, picked by the FAQs' own fields (`scope` and `destination`). The agent
 * answers only from what comes back. It stands in for a real RAG, which WeRoad's full help center
 * would need.
 */
export function getFaq(options: { destination?: string }): FaqResult {
  const destination = options.destination?.trim() || null;
  const general = faqs.filter((f) => f.scope === "general");
  const own = destination ? faqs.filter((f) => f.scope === "destination" && f.destination && same(f.destination, destination)) : [];

  const notes: string[] = [];
  if (destination && own.length === 0) {
    notes.push(
      destinations.some((d) => same(d, destination))
        ? `There is no help-center article for ${destination}; only the general articles apply.`
        : `${destination} is not a destination WeRoad has a trip to in this catalog; only the general articles apply.`,
    );
  }

  const pick = ({ id, scope, destination, title, body }: Faq) => ({ id, scope, destination, title, body });
  return { destination, articles: [...own, ...general].map(pick), notes };
}
