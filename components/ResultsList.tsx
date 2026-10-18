import { formatPrice } from "@/lib/page/format";
import { resultTags } from "@/lib/page/tags";
import type { ResultView } from "@/lib/page/types";
import type { SearchState } from "@/lib/search/types";

/**
 * The search results. Each links to the trip's page on weroad.com, the click the guardrail counts.
 * When nothing matched, a banner says so and each result's tags say how it differs from the search.
 */
export function ResultsList({ results, originalState }: { results: ResultView[]; originalState: SearchState }) {
  if (results.length === 0) {
    return <p className="empty">No trips match this search.</p>;
  }
  const tags = results.map((result) => resultTags(originalState, result));
  const suggested = tags.some((t) => t.length > 0);
  return (
    <section aria-label="Search results">
      <h2>{suggested ? "No exact matches. Closest options:" : results.length === 1 ? "1 trip" : `${results.length} trips`}</h2>
      <ul className="results">
        {results.map((result, i) => (
          <li key={result.tripId}>
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.title}
            </a>
            <p>
              {result.destination} · {result.days} days · from {formatPrice(result.fromPrice)}
            </p>
            {tags[i].length > 0 && (
              <p className="tags">
                {tags[i].map((text) => (
                  <span key={text} className="tag">
                    {text}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
