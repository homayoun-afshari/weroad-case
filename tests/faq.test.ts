import { describe, expect, it } from "vitest";
import { destinations, faqs } from "@/lib/search/catalog";
import { getFaq } from "@/lib/search/faq";
import { faqInputSchema } from "@/lib/search/schema";

const general = faqs.filter((f) => f.scope === "general");

describe("help-center articles", () => {
  it("returns the general articles when no destination is named", () => {
    const result = getFaq({});
    expect(result.destination).toBeNull();
    expect(result.articles.map((a) => a.id)).toEqual(general.map((f) => f.id));
    expect(result.articles.every((a) => a.scope === "general" && a.destination === null)).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it("puts the destination's article first, then the general ones", () => {
    const result = getFaq({ destination: "Iceland" });
    expect(result.articles).toHaveLength(general.length + 1);
    expect(result.articles[0]).toMatchObject({ id: 34, scope: "destination", destination: "Iceland" });
    expect(result.articles[0].title).toBe("What’s the weather like in Iceland?");
    expect(result.articles.slice(1).map((a) => a.id)).toEqual(general.map((f) => f.id));
    expect(result.notes).toEqual([]);
  });

  it("matches a destination without caring about case or spaces", () => {
    expect(getFaq({ destination: "  iceland " }).articles[0].id).toBe(34);
    expect(getFaq({ destination: "COSTA RICA" }).articles[0].destination).toBe("Costa Rica");
  });

  it("gives the general articles and says so when a trip's destination has no article", () => {
    // 15 trip destinations have no article, Sweden among them
    const result = getFaq({ destination: "Sweden" });
    expect(result.articles.map((a) => a.id)).toEqual(general.map((f) => f.id));
    expect(result.notes).toEqual(["There is no help-center article for Sweden; only the general articles apply."]);
  });

  it("says so when the destination is not one WeRoad has a trip to", () => {
    const result = getFaq({ destination: "Brazil" });
    expect(result.articles).toHaveLength(general.length);
    expect(result.notes).toEqual(["Brazil is not a destination WeRoad has a trip to in this catalog; only the general articles apply."]);
  });

  it("hands over the articles exactly as the data has them", () => {
    for (const article of getFaq({ destination: "Japan" }).articles) {
      const source = faqs.find((f) => f.id === article.id)!;
      expect(article).toEqual({ id: source.id, scope: source.scope, destination: source.destination, title: source.title, body: source.body });
    }
  });

  it("has an article for 35 destinations and none for the other 15 of the catalog", () => {
    const withArticle = destinations.filter((d) => getFaq({ destination: d }).notes.length === 0);
    expect(withArticle).toHaveLength(35);
    expect(destinations.filter((d) => getFaq({ destination: d }).notes.length > 0)).toHaveLength(15);
  });

  it("stays small enough to send with a turn", () => {
    const size = JSON.stringify(getFaq({ destination: "Iceland" })).length;
    expect(size).toBeLessThan(20_000);
  });
});

describe("what the articles do not cover", () => {
  it("has no article about travel visas: the only mention of 'visa' is a card brand in the payment article", () => {
    const mentions = faqs.filter((f) => /visa/i.test(`${f.title} ${f.body}`));
    expect(mentions.map((f) => f.id)).toEqual([5]);
    expect(mentions[0].title).toBe("What payment methods can I use?");
    expect(mentions[0].body).toMatch(/visa/i);
    // so a question about visas gets that article among the general ones, and must not be answered from it
    expect(getFaq({}).articles.some((a) => a.id === 5)).toBe(true);
  });

  it("has one practical topic per destination, so an article can exist without covering the question", () => {
    // Iceland's article is about the weather: it says nothing about plugs
    const iceland = getFaq({ destination: "Iceland" }).articles[0];
    expect(iceland.body).toMatch(/weather|temperature/i);
    expect(iceland.body).not.toMatch(/plug|voltage/i);
  });

  it("holds the 'Open to book' article with the rule about a first booking", () => {
    const open = getFaq({}).articles.find((a) => a.id === 7)!;
    expect(open.title).toContain("Open to book");
    expect(open.body).toMatch(/first booking/i);
    expect(open.body).toMatch(/€\/£\/\$0 deposit/);
    expect(open.body).toMatch(/wait for the departure to be confirmed before purchasing your round-trip flights/i);
  });
});

describe("the tool's input", () => {
  it("takes an optional destination", () => {
    expect(faqInputSchema.safeParse({}).success).toBe(true);
    expect(faqInputSchema.safeParse({ destination: "Iceland" }).success).toBe(true);
  });

  it("rejects a destination that is not text, or far too long", () => {
    expect(faqInputSchema.safeParse({ destination: 5 }).success).toBe(false);
    expect(faqInputSchema.safeParse({ destination: "x".repeat(61) }).success).toBe(false);
  });
});
