import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultsList } from "@/components/ResultsList";
import { pageStateFor } from "@/lib/page/view";
import type { SearchRequest } from "@/lib/search/types";

const html = (request: SearchRequest) => {
  const page = pageStateFor(request);
  return renderToStaticMarkup(<ResultsList results={page.results} originalState={page.originalState} />);
};

describe("the results list", () => {
  it("shows the count and no banner or tags when the results match", () => {
    const markup = html({ text: "northern lights" });
    expect(markup).toContain("<h2>3 trips</h2>");
    expect(markup).not.toContain("No exact matches");
    expect(markup).not.toContain('class="tag"');
  });

  it("uses the singular for one trip", () => {
    expect(html({ text: "iceland" })).toContain("<h2>1 trip</h2>");
  });

  it("says there are no exact matches, and tags each result with how it differs", () => {
    const markup = html({ text: "hiking in Argentina under 2000" });
    expect(markup).toContain("<h2>No exact matches. Closest options:</h2>");
    expect(markup).not.toContain("trips</h2>");
    expect(markup).toContain('<span class="tag">€4,169 · above your €2,000</span>');
    expect(markup).toContain('<span class="tag">other destination (you asked for Argentina)</span>');
    // one tag line for each of the six results
    expect(markup.match(/<p class="tags">/g)).toHaveLength(6);
  });

  it("shows at most the 10 nearest options", () => {
    const markup = html({ text: "", dates: { from: "2026-10-19", to: "2026-10-24" } });
    expect(markup.match(/<li>/g)).toHaveLength(10);
    expect(markup).toContain("No exact matches. Closest options:");
  });

  it("links every result to its trip page on weroad.com, in a new tab", () => {
    const markup = html({ text: "hiking in Argentina under 2000" });
    const links = markup.match(/<a href="https:\/\/www\.weroad\.com\/[^"]+" target="_blank" rel="noopener noreferrer">/g);
    expect(links).toHaveLength(6);
  });

  it("says so when there is nothing to show", () => {
    const page = { ...pageStateFor({ text: "iceland" }), results: [] };
    expect(renderToStaticMarkup(<ResultsList results={page.results} originalState={page.originalState} />)).toContain(
      "No trips match this search.",
    );
  });
});
