import { formatPrice } from "@/lib/page/format";
import type { ResultView } from "@/lib/page/types";

/** The search results. Each links to the trip's page on weroad.com, the click the guardrail counts. */
export function ResultsList({ results }: { results: ResultView[] }) {
  if (results.length === 0) {
    return <p className="empty">No trips match this search.</p>;
  }
  return (
    <section aria-label="Search results">
      <h2>{results.length === 1 ? "1 trip" : `${results.length} trips`}</h2>
      <ul className="results">
        {results.map((result) => (
          <li key={result.tripId}>
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.title}
            </a>
            <p>
              {result.destination} · {result.days} days · from {formatPrice(result.fromPrice)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
