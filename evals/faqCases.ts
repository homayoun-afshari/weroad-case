/**
 * Help-center questions with what a grounded answer says and what it must not. The checks are
 * patterns: they find the breaches seen in live runs, and they don't judge style.
 */

export interface FaqCase {
  id: string;
  question: string;
  /** Patterns of which every one must appear in the answer. */
  mustSay: RegExp[];
  /** Patterns of which none may appear: claims the articles don't make. */
  mustNotSay: RegExp[];
}

/** "I don't have it", in the ways the model says it. */
export const DOESNT_KNOW = /(?:don't|do not|can't|cannot|couldn't|could not)\s+(?:have|find|answer|tell|say)|no (?:help-center |help center )?article/i;

export const FAQ_CASES: FaqCase[] = [
  {
    id: "visa",
    question: "Do I need a visa?",
    // No article covers travel visas: "Visa" is only a card brand in the payment-methods article
    mustSay: [DOESNT_KNOW],
    mustNotSay: [/government|embassy|consulate|passport|e-?visa/i],
  },
  {
    id: "plugs-iceland",
    question: "What are the plugs like in Iceland?",
    // Iceland's article is about the weather
    mustSay: [DOESNT_KNOW],
    mustNotSay: [/\btype\s+[a-z]\b/i, /\b\d{3}\s?v\b|voltage/i],
  },
  {
    id: "currency-sweden",
    question: "What's the currency in Sweden?",
    // Sweden has no article at all
    mustSay: [DOESNT_KNOW],
    mustNotSay: [/travel group leader/i, /krona|\bSEK\b/i],
  },
  {
    id: "unconfirmed-deposit",
    question: "What happens if I book an unconfirmed departure? Do I have to pay?",
    // Article 7: a first booking on an unconfirmed departure needs no payment, a card as a guarantee
    mustSay: [/first\s+(?:unconfirmed\s+)?booking/i, /€\/£\/\$0|no(?:thing)?\s+(?:to pay|upfront|immediate)|without paying|pay(?:ing)?\s+(?:anything|nothing)|zero/i],
    // The guarantee is a card in article 7; PayPal and Revolut are payment methods in article 5
    mustNotSay: [/(?:paypal|revolut)[^.]*guarantee|guarantee[^.]*(?:paypal|revolut)/i],
  },
  {
    id: "weather-iceland",
    question: "What's the weather like in Iceland?",
    mustSay: [/south iceland|midnight sun|june to august|highlands/i],
    mustNotSay: [],
  },
  {
    id: "cancel",
    question: "Can I cancel my booking?",
    mustSay: [/myweroad/i],
    mustNotSay: [],
  },
];

/** The breaches of one case in one answer: what it left out and what it claimed. Empty when it is grounded. */
export function checkFaqAnswer(faq: FaqCase, answer: string): string[] {
  return [
    ...faq.mustSay.filter((p) => !p.test(answer)).map((p) => `missing: ${p}`),
    ...faq.mustNotSay.filter((p) => p.test(answer)).map((p) => `claims: ${p}`),
  ];
}
