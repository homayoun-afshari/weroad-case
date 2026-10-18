# Write-up

The two-page version (also as `WRITE_UP.pdf`). Details are in `DESIGN.md`, `BUILD.md`, `AGENT_GRAPH.md` and `SEARCH_FUNCTION.md`. "_Brief: §3 (p. 2), …_" is a location in the brief; "choice A" is in `DESIGN.md`; "next step B" and "suggestion A" are in `BUILD.md`, Notes.

## The idea

One search function sits behind both the page and the chat: the search button calls it, and so does the agent's `search_trips` tool. The assistant changes the search request and the page shows what the function returns, so the two cannot disagree, and the list updates in the same order. The assistant helps the page and never replaces it, and the page works without it. _Brief: §2 (p. 1), the A/B test that lost 36–41% of product clicks; §3 (p. 2), "Searches like the page does"._

## The seven topics

**First turn and later turns.** The chat starts when the user presses a button, so opening it is a countable event, and the first message is written by code from the page state: no model call, no new search (choice A). Later, each user message carries what the user did on the page since the last one (a search, an undo, an unsearched change in the controls), then the page as it is now. The agent never asks what the page already answers. _Brief: §3 (p. 2), "Starts from the page"._

**From conversation to search, and consistency.** `search_trips` forms the complete new request (keep, change or drop) and runs the search function in the same step, so the answer and the page come from the same results (choice G). Undo restores the page only, and the agent is told, so it doesn't propose the same change again.

**Other tools.** "When" about the trips on screen goes to `get_departures` and leaves the page alone; "how things work" goes to `get_faq`; a trip's days to `get_itinerary`; a person to `hand_over`. The eval checks the routing. _Brief: §3 (p. 2), "Picks the right tool"._

**Business rules** live in code, with tests, behind the tools: only upcoming departures with a bookable sales status count, never seats left; a date window matches departures fully inside it; the price shown is the cheapest bookable departure that matches the filters; a promised hand-over is replaced in code. The prompt holds none. _Brief: §4 (p. 2), "where the business rules live"._

**Failure.** An empty search never leaves the page empty: the suggester loosens one value at a time and the page says what differs (choice I). A failed turn maps to one of five messages by cause, no detail leaks, and the page stays usable. _Brief: §3 (p. 2), "Never a dead end"._

**Evaluation.** Cases decided by code run in Vitest on every change (360 tests). A live eval plays 22 conversations against the real model, three runs each: in the last run 64 of 69 turns passed every check, and 67 once I corrected one of my own checks. A run costs about $0.08. Next, an A/B test on the brief's metrics, with product clicks as the guardrail (next step A).

**What to build first.** The product slice: the chat knows the page, updates the search and answers departure questions, with FAQ and hand-over after.

## Decisions and why

- **Rule-based search (choice J),** so a press of the search button is not a model call and the page survives a model failure. The cost: rules understand fewer phrasings, and the agent covers that in the chat.
- **One tool that changes the search (choice G),** so the controls and the list can never contradict each other.
- **A tool for departures (choice K),** because dates are the largest pre-booking theme, and the tool applies the rules in code, not the model.
- **State on the client (choice D),** so the server needs no database.
- **In-house retrieval for the FAQs (choice L):** 50 articles with a destination field need no embeddings.

## What I cut, and why

A real hand-over (the prototype's "yes" ends the chat; next step B), redo, a cap on the history, tracing, and website pages, promotions and flight prices, which the data has nothing for (next step L). **Narrowing works by words, not by meaning:** the brief says the assistant narrows "with its own reasoning", while "cooking class" becomes a word in the search (choice M); meaning is next step H. _Brief: §3 (p. 2), "Reasons where search cannot"._

## Risks

- **Rules understand fewer phrasings.** "USA" worked only after I told the agent to write "United States".
- **The model slips in ways no check catches:** a miscount once in 21 reviewed answers, and the visa question skipped the help center in one run of three. The strict check on prices and dates also has false positives.
- **The status mapping is my assumption:** neither the data nor the FAQ links the statuses to "Open to book" by name.
- **The help center contradicts itself** on the guarantee for an unconfirmed booking (suggestion B).
- **The chat may still take clicks from the page.** Only the A/B test shows it.
- **The eval is small:** one or two turns of difference is noise.

## What comes next

Run the A/B test with the brief's metrics (next step A); a real hand-over, where a person joins the same chat (next step B); WeRoad's classifier in place of my translator (next step F); a real RAG for a larger, multilingual help center (next step K). On WeRoad's side, a fuller Search API that returns the understood state and the suggestions would help every page, not only the chat (suggestion A).

**Conversion** cannot be measured in the prototype, as there is no booking. It would be measured in the A/B test: the share of searches that open the assistant and their conversion against the rest, the undo rate, the zero-result share and latency, with SERP engagement as the guardrail. _Brief: §3 (p. 2), the paragraph on success._
