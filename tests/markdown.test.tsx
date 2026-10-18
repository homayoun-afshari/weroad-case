import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/Markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("the assistant's markdown", () => {
  it("renders a bold list as the model writes it (seen live)", () => {
    const markup = html("None of the trips fits.\n- **Iceland** leaves 20 October.\n- **Sweden** leaves 31 October.\nI can search all trips.");
    expect(markup).toBe(
      "<p>None of the trips fits.</p><ul><li><strong>Iceland</strong> leaves 20 October.</li><li><strong>Sweden</strong> leaves 31 October.</li></ul><p>I can search all trips.</p>",
    );
  });

  it("renders numbered lists and separates paragraphs at blank lines", () => {
    expect(html("First.\n\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
    expect(html("1. One\n2. Two")).toBe("<ol><li>One</li><li>Two</li></ol>");
  });

  it("leaves plain text alone, and a lone asterisk pair is not bold", () => {
    expect(html("Max €2,000, 8 days.")).toBe("<p>Max €2,000, 8 days.</p>");
    expect(html("a ** b")).toBe("<p>a ** b</p>");
  });

  it("injects no HTML: markup in a message is shown as text", () => {
    expect(html("<img src=x onerror=alert(1)> **ok**")).toBe("<p>&lt;img src=x onerror=alert(1)&gt; <strong>ok</strong></p>");
  });
});
