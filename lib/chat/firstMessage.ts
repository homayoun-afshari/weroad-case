import { formatPrice } from "@/lib/page/format";
import { isSuggested } from "@/lib/page/suggested";
import type { PageState } from "@/lib/page/types";
import { describeFilters } from "./blocks";

/**
 * The assistant's first message, written by code from the page state: no model call and no new
 * search, so starting the chat is instant and free, and the assistant asks nothing the page answers.
 */
export function firstMessage(page: PageState): string {
  const { request, results } = page;
  const terms = [...(request.text ? [`"${request.text}"`] : []), ...describeFilters(request)];
  const search = terms.length ? ` for ${terms.join(", ")}` : "";
  const offer = "I can change the search, check dates or answer questions.";

  if (results.length === 0) return `The page shows no trips${search}. ${offer}`;

  const cheapest = Math.min(...results.map((r) => r.fromPrice));
  const starts = results.length === 1 ? "It starts" : "They start";
  if (isSuggested(page)) {
    const options = results.length === 1 ? "the closest option" : `the ${results.length} closest options`;
    return `No trip matches ${terms.join(", ")} exactly. The page shows ${options} instead. ${starts} from ${formatPrice(cheapest)}. ${offer}`;
  }

  const count = results.length === 1 ? "1 trip" : `${results.length} trips`;
  return `You're looking at ${count}${search}. ${starts} from ${formatPrice(cheapest)}. ${offer}`;
}
