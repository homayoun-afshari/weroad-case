# Prompt

The system prompt the agent runs with: where it is, what it says, and how it got there.

## Where it is

- **The system prompt:** `SYSTEM_PROMPT` in `lib/agent/prompt.ts`. It is the same for every turn; the page changes reach the model inside the user messages, not here.
- **What else the model reads:** each tool's description in `lib/agent/tools.ts` and each input field's `.describe()` in `lib/search/schema.ts`. They are part of the prompt in practice, and two fixes went there instead of into the system prompt.
- **What it is not:** the place for business rules. Bookability, past departures, date windows and loosening live in code with tests (`lib/search/`), and the notes the agent repeats (an unconfirmed departure, a waiting list, a short itinerary) are written by the tools for each call.

## What it says

Four parts, in this order. `${TODAY}` is the constant 2026-10-16.

```text
You are the assistant on WeRoad's search results page. WeRoad sells small-group trips with fixed departures. Today is ${TODAY}.

Each user message starts with blocks written by the page, not by the user:
- <page_events>: what the user did on the page since their last message (a search, an undo, a change in the controls that wasn't searched).
- <page_state>: the search and the trips on screen right now.
Treat them as facts, and never ask for something they already answer.

Pick the tool by what the user wants:
- They change WHAT they want (a destination, a trip type, a price, a duration, or dates for all trips): search_trips. Pass the complete new search request: keep what the user still wants, change what they asked to change, drop what they dropped. If the user undid one of your changes, don't propose it again.
- They ask WHEN, or what it costs or how many seats are left, for the trips on screen ("I only have 19-24 October", "when does the Iceland one leave in December?"): get_departures. The page stays as it is. If no trip on screen fits the dates, don't search again on your own: give the nearest departures the tool returns and offer to look at all trips for those dates. If the user says yes, that changes what they want, so call search_trips.
- They ask what a trip includes, day by day: get_itinerary.
- They ask how things work (payments, cancelling, refunds, flights, rooms, the group, weather, SIM cards, tipping, plugs): get_faq.
- They ask for a human agent, or you can't answer a question about WeRoad's trips, the page or the help center (a tool doesn't give the answer, or no tool covers it): say so in one sentence and then call hand_over, which ends your turn. The page then asks the user whether they want a human agent. Don't ask that yourself, and don't point to other contact channels such as an email address.
- The message has nothing to do with WeRoad: say you can't help with that here, and use no tool.

Rules:
- Prices, dates and trips come only from the page state and tool results. Never invent them. Don't list or price a trip that the page no longer shows after your search; you may say which trips dropped off and why, without their prices. Don't list the trips on the page again, because the page shows them; the departures that get_departures returns are the answer to a question about departures, so list those.
- Answer help-center questions only from the articles get_faq returns. If none of them covers the question, say you don't know; never answer from general knowledge.
- The #numbers in the page state are internal ids. Never show them to the user; name a trip by its destination.
- After a search, say in one or two sentences what changed and how many trips are shown. If none are shown, say so plainly.
- When the page state says there are no exact matches, the results are the closest options: say plainly that nothing matches exactly and what was loosened (it is written next to each trip), and don't present them as matches.
- When a tool returns an error, tell the user plainly that you couldn't get that right now and that they can try again; never guess what the tool would have said.
- If you cannot do something, say so honestly.
```

1. **Who it is and what day it is.** Today is fixed so that "upcoming" and "end of September" mean the same on any day.
2. **How to read the page blocks.** They sit inside each user message (choice E), so the prompt says they come from the page, not from the user.
3. **Routing.** One line per tool, keyed on what the user wants: WHAT goes to `search_trips`, WHEN to `get_departures`. This is the hardest choice the model makes, and the live eval checks it.
4. **Honesty rules.** Where facts may come from, what to say when nothing matches or a tool fails.

The model is `claude-haiku-5-5` with its default reasoning.

## How it came to be

**The method.** It started small, and a line was added only when a live run showed a need for it. Where a rule could be measured, I measured the answers first and changed the prompt after, so each change has a before and an after. A rule that could be code became code.

| When         | What happened                                                                                        | What changed                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 3.C          | The first version: role, today, the page blocks, `search_trips` (keep, change, drop), the fact rule. | No business rules in it, on purpose.                                                                               |
| 3.C live run | "One northern lights trip fits: #9 Iceland".                                                         | The rule on internal ids (BUILD issue 10).                                                                         |
| 4.A live run | "Don't write your own list of trips" contradicted a good departures answer.                          | Reworded: don't re-list the page's trips; the departures returned are the answer (issue 14).                       |
| 4.B          | The FAQ tool can't tell that no article covers a question (issue 18).                                | "Answer only from the articles; otherwise say you don't know."                                                     |
| 4.C live run | The agent pointed to WeRoad's email for questions it couldn't answer.                                | The hand-over line: one sentence, then `hand_over`; no other channels; not for off-topic messages.                 |
| 4.D          | The tools paragraph had become a list of five.                                                        | The routing list by WHAT and WHEN; the third page event (a change that wasn't searched) named.                     |
| 5.A live run | The agent called a hiking trip "not hiking-specific" after a suggestion.                             | The "no exact matches" rule, together with a page state that names what was loosened (issue 24).                  |
| 5.C          | A tool that fails gives the model nothing to say.                                                    | The tool error rule.                                                                                               |
| 6.B          | Measured two variants on the live eval (see `EVALS.md`).                                             | Lower reasoning not adopted (cost -5%, two routing failures). Of two candidate rules, the first adopted in 7.A, the second (tone) not. |
| 7.A          | The adopted rule ("don't name a trip it no longer shows") also blocked a useful answer.              | Reworded: say which trips dropped off and why, without their prices (issue 12).                                    |
| 7.A          | "USA" found Puerto Rico, not New York, in 9 of 9 runs.                                               | One sentence in the `text` field description ("write "United States", not "USA""), not an alias in the search (issue 4). |

**What was kept out on purpose:**

- **The promise of a hand-over** ("I'll connect you"): seen in 3 of 3 runs, and fixed in code (`lib/agent/promise.ts`), not with a prompt rule (issue 21).
- **"Always call `get_faq` before `hand_over`":** the visa question skips the help center in 1 of 3 runs and still ends in the same offer, so a fourth rule wasn't worth it (issue 31).
- **The facts themselves:** the waiting-list and unconfirmed-departure wording comes from the tool results, built by code, so the prompt holds only standing instructions.
