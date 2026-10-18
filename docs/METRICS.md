# Metrics

The brief measures success by "the share of searches that open the assistant, their conversion against the rest, how often users undo what it did, zero-result share and latency, with no drop in SERP engagement as the guardrail".

The prototype doesn't log any of them: nothing outlives the page session and there is no event store or tracing (next steps C, D and M in `BUILD.md`). It was built so that each one is a count of something the code already does in one place. This file says where that place is, and how each metric would be measured.

## What measuring needs

One event log on the server, keyed by a session id, with a timestamp on each event. Every event below comes from one function that exists today, so logging it is one line at that spot.

| Event                      | Where it happens                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| a search, by the user      | `onSearch` in `components/SearchApp.tsx` (`POST /api/search`), and the opening search in `app/page.tsx` |
| a search, by the assistant | `search_trips` in `lib/agent/tools.ts`, applied by `push(…, "assistant")`                 |
| the assistant is opened    | `onStart` in `components/SearchApp.tsx` (the **Ask the assistant** button)                |
| an undo                    | `undo` in `lib/page/history.ts`, which returns whose change it reversed                   |
| a product click            | the trip link of each result in `components/ResultsList.tsx`                              |
| a chat turn                | `runTurn` in `lib/agent/turn.ts`, which returns the tokens used                           |

## The metrics

**1. The share of searches that open the assistant.**

- **What enables it:** the chat is loadable, not awake (choice A). Until **Ask the assistant** is pressed nothing runs, and pressing it is one event. The first message is written by code, so opening costs no model call and needs no new search to count. The assistant never speaks first, so every opening is the user's.
- **How:** sessions with an opening ÷ sessions with a search; or, per search, whether the assistant was opened while that search was on screen. The page state at the opening is known (`firstMessage` is written from it), so openings can be split by the search that led to them, such as an empty search against a full one.

**2. Their conversion against the rest.**

- **What enables it:** each result links to its trip page (the product click), and only that link leads to the trip page, so a click is a single event; the session knows whether the assistant was opened.
- **How:** product clicks per search, and bookings joined on WeRoad's side by session id, for sessions that opened the assistant against sessions that didn't. Users who open it choose to, so that comparison is biased. The fair one is an A/B test: the same page with and without the **Ask the assistant** button (next step A).

**3. How often users undo what it did.**

- **What enables it:** every entry of the page history is tagged `user` or `assistant`, and `undo` returns whose change it reversed (choice C). A search that repeats the page's search adds no entry, so it can't inflate the count (BUILD issue 35). Undo is a button, not a tool, so asking the chat to go back is a new search, not an undo (choice G).
- **How:** undos that reversed an assistant change ÷ assistant changes. The undo event also says what was undone and what was restored, so the undone changes can be read by kind (a price, dates, the text).

**4. Zero-result share.**

- **What enables it:** the suggester runs only when the raw results are empty (choice I), and `isSuggested` in `lib/page/suggested.ts` says whether a page holds suggested results. The page never shows nothing, so "zero results" means "the search had no exact match".
- **How:** searches with suggested results ÷ all searches, split by caller (the button or the assistant), since the assistant should rewrite searches that the rules miss ("New Year's Eve", "USA"). Next to it: product clicks on suggested results, which says whether the nearest options help.

**5. Latency.**

- **What enables it:** the search button never calls the model (choice J), so the page's latency is the search function's alone. A chat turn has a fixed limit: at most 5 steps and 30 seconds (`TURN_TIMEOUT_MS` in `lib/agent/turn.ts`), so the worst case is bounded.
- **How:** the time of each search route call and of each chat turn, from the request to the response, with the tokens of the turn. The live eval already measures it per turn: 3.2 s on average and 6.3 s at most in the final run (`EVALS.md`). In production, one trace per turn with each model and tool call (next step M).

**6. The guardrail: no drop in SERP engagement.**

- **What enables it:** the assistant helps the page and doesn't replace it. The chat stays closed until the user opens it, never writes first, and changes the page only through the same search function, so the results list is always one the search controls can reproduce. The page works without the model, so a slow or failing model can't lower engagement.
- **How:** in the A/B test of metric 2, product clicks per search and the share of searches with at least one click, in both arms; the assistant arm must not be lower.
