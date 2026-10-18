# Evals

How the prototype is evaluated before shipping: the test cases, the evals that judge them, and what the runs showed. There are two levels, because a mocked model can't show that the right tool is chosen.

| Level       | Cases                                     | Run with                          | Model             | Cost         |
| ----------- | ----------------------------------------- | --------------------------------- | ----------------- | ------------ |
| **Offline** | `tests/eval.test.ts`                      | `npm test`                        | none              | nothing      |
| **Live**    | `evals/cases.ts` and `evals/faqCases.ts`  | `npm run eval` (`EVAL_RUNS`, `EVAL_VARIANT`) | `claude-haiku-5-5` | about $0.08 a run |

## 1. Offline cases

The brief's own examples, which the data was built around, run through the code only (the search function, the departures, the FAQ). Each one is also checked against the raw data by brute force, so a bug in the search can't hide behind itself. All in `tests/eval.test.ts`.

| Case                                    | What it checks                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| "USA"                                   | No alias: whole words find Puerto Rico (33) only, not Busan or "thousand"; "United States" finds New York (22).                       |
| "northern lights"                       | Read as the trip type, not text: exactly the three trips of that type (9, 11, 41).                                                    |
| "New Year's Eve"                        | In no trip's text, so the page shows the nearest options with the text loosened; 39 departures run over 31 December; a date window around it finds exactly the trips with a bookable departure inside. |
| "cooking class"                         | Not a filter: the words find trips 13, 15, 19; "cooking" alone finds 13, 15, 19, 24, 40 (how the agent narrows).                      |
| "hiking in Brazil or Argentina…"        | No Brazil trip and no September departure for Patagonia; Patagonia (23) is the nearest option, with the words loosened and Argentina kept. |
| "ok, any period, but max 2,000"         | Every trip with a bookable departure at €2,000 or less; dropping the dates widens the search.                                          |
| "I only have 19-24 October"             | No trip fits (the three departures inside are NOT_AVAILABLE); `get_departures` gives the nearest ones and how far they are; a search gives 10 options with the dates loosened. |
| "Do I need a visa?"                     | No article covers visas; the only "visa" is the card brand in the payment article; the destination articles cover one practical topic each. |

## 2. Live cases

Conversations with the real model. Each opens on a page with a search applied (`northern lights` unless stated) and the first message written by code, then plays its turns the way the browser does. Each turn states the tools it must call (**exactly**, **includes** or **any of**), whether the page must change, and any check of its own. All in `evals/cases.ts`.

| Case                    | The user says                                           | Tools                               | Page      | Its own check                                                    |
| ----------------------- | ------------------------------------------------------- | ----------------------------------- | --------- | ---------------------------------------------------------------- |
| `departures-window`     | I only have 19-24 October                               | exactly `get_departures`            | unchanged |                                                                  |
| `departures-trip-month` | When does the Iceland one leave in December?            | exactly `get_departures`            | unchanged |                                                                  |
| `departures-seats`      | How many seats are left on the Sweden one?              | exactly `get_departures`            | unchanged |                                                                  |
| `cheaper`               | Something cheaper, max 1,500                            | exactly `search_trips`              | changed   | max price 1,500; "northern lights" kept                          |
| `forget-and-dates`      | Forget the northern lights, anything on 19-24 October   | exactly `search_trips`              | changed   | dates 19–24 October; "northern lights" dropped                   |
| `itinerary`             | What do we do on day 3 in Iceland?                      | exactly `get_itinerary`             | unchanged |                                                                  |
| `human`                 | I want to talk to a person                              | exactly `hand_over`                 | unchanged |                                                                  |
| `off-topic`             | What's the capital of France?                           | none                                | unchanged | no hand-over offered                                             |
| `faq-weather`           | What's the weather like in Iceland?                     | includes `get_faq`                  | unchanged | FAQ case `weather-iceland`                                       |
| `faq-cancel`            | Can I cancel my booking?                                | includes `get_faq`                  | unchanged | FAQ case `cancel`                                                |
| `faq-visa`              | Do I need a visa?                                       | includes `get_faq`, `hand_over`     | unchanged | FAQ case `visa`                                                  |
| `faq-plugs`             | What are the plugs like in Iceland?                     | includes `get_faq`                  | unchanged | FAQ case `plugs-iceland`                                         |
| `faq-currency`          | What's the currency in Sweden?                          | includes `get_faq`                  | unchanged | FAQ case `currency-sweden`                                       |
| `faq-unconfirmed`       | What happens if I book an unconfirmed departure? Do I have to pay? | includes `get_faq`       | unchanged | FAQ case `unconfirmed-deposit`                                   |
| `usa`                   | I'd like to go to the USA                               | includes `search_trips`             | changed   | New York (22) in the results                                     |
| `brazil-argentina`      | hiking in Brazil or Argentina end of September          | includes `search_trips`             | changed   | Patagonia (23) shown; says nothing matches exactly; hand review  |
| `new-years-eve`         | Anything for New Year's Eve?                            | any of `search_trips`, `get_departures` |       | if it searched, the dates cover the night of 31 December         |
| `narrow-cooking`        | Only the ones with a cooking class (opens on all trips) | includes `search_trips`             | changed   | "cooking" in the text; only trips 13, 15, 19, 24, 40             |
| `any-period`            | ok, any period, but max 2,000 (opens on December)       | includes `search_trips`             | changed   | dates dropped; max price 2,000                                   |
| `suggestions-argentina` | hiking in Argentina under 2000                          | includes `search_trips`             | changed   | the results are suggestions; says nothing matches exactly; hand review |
| `suggestions-japan`     | Japan under 800                                         | includes `search_trips`             | changed   | the same as above                                                |
| `offer-then-yes`        | 1. I only have 19-24 October · 2. yes please, show me all trips for those dates | 1. exactly `get_departures` · 2. includes `search_trips` | 1. unchanged · 2. changed | 2: dates 19–24 October; hand review |

**FAQ cases** (`evals/faqCases.ts`): what a grounded answer must say and must not say, as patterns.

| FAQ case              | Must say                                     | Must not say                         | Why                                                |
| --------------------- | -------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| `visa`                | that it doesn't know                         | government, embassy, passport, e-visa | No article covers visas.                          |
| `plugs-iceland`       | that it doesn't know                         | a plug type or a voltage             | Iceland's article is about the weather.           |
| `currency-sweden`     | that it doesn't know                         | Travel Group Leader, krona or SEK    | Sweden has no article.                            |
| `unconfirmed-deposit` | "first booking" and that nothing is paid now | nothing                              | Article 7; articles 4 and 7 disagree on the guarantee, so either is grounded. |
| `weather-iceland`     | South Iceland, midnight sun, June to August or the highlands | nothing              | Iceland's article.                                |
| `cancel`              | MyWeRoad                                     | nothing                              | The cancelling article.                           |

## 3. Evals

What each live turn is judged on. The judgments are code, not a model judge. The first five are in `evals/engine.ts` (`judge`), the next two in `evals/checks.ts`.

| Eval                    | What it checks                                                                          | How it's measured                                                         |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **tools**               | The turn called the tools its case expects.                                             | The tool calls in the turn's entries against the case's spec.             |
| **page**                | The page changed, or stayed, as expected.                                               | Whether the turn returned a new page state.                               |
| **check**               | The case's own check on the new search, the results or the answer.                      | The case's function, one line per failure.                                |
| **faq**                 | A help-center answer says what it must and nothing it must not.                         | The FAQ case's patterns on the answer.                                    |
| **promise**             | A hand-over turn doesn't promise the connection ("I'll connect you").                   | `promisesHandOver` on the answer the user sees.                           |
| **ungrounded**          | Every price and day in the answer is stated by a source: the page after the turn, this turn's tool results, the user's words or today. Derived figures count as not stated. | The amounts and days found in the answer that no source contains. |
| **stale**               | The answer doesn't price a trip the search just took off the page.                      | A sentence that names such a trip and an amount the user didn't give.     |
| **hand review**         | Miscounts and invented distinctions, which no pattern catches.                          | The answers of the `review` turns, printed for me to read.                |

A turn is **clean** when it passes every eval. A run reports the clean turns, the failures by kind, the errors by status, the tokens, the estimated cost and the latency (mean and max), in `evals/results/<variant>.md` (summary and answers to read) and `.json` (every turn). The evals themselves are tested in `tests/evalChecks.test.ts` and `tests/evalEngine.test.ts`.

## 4. Variants and results

Three variants, in `evals/variants.ts`, three runs of each case (69 turns).

| Variant         | What changes                                     | Clean turns | Cost    | Latency mean / max | Decision                                    |
| --------------- | ------------------------------------------------ | ----------- | ------- | ------------------ | ------------------------------------------- |
| `baseline`      | The app's prompt and settings                    | 64 of 69    | $0.078  | 3.2 s / 6.3 s      | The final run, after the fixes of block 7.  |
| `low-reasoning` | Reasoning set to low                             | 53 of 69    | $0.073  | 3.4 s / 7.4 s      | Not adopted: 5% cheaper, no faster, two routing failures. |
| `rules`         | Two extra prompt rules (see `PROMPT.md`)         | 58 of 69    | $0.078  | 3.2 s / 8.5 s      | The first rule adopted (then reworded), the second not. |

The `low-reasoning` and `rules` files are from block 6, before the fixes and the corrected checks; the baseline of that time had 56 clean turns. Of the final baseline's five flags, three are stale-trip flags that the corrected check no longer raises (67 of 69 by reading), one is the visa question skipping `get_faq` once (a measured limit), and one is "31 December", the model's own translation of "New Year's Eve" (a false positive of the strict reading).

**What the evals don't cover:** the tone of an answer, a miscount found only by hand ("the other six" for five), ambiguous or mixed messages, and long conversations. Three runs a case can't tell apart variants that differ by one or two turns.
