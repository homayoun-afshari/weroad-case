# Build

This is the record of how the prototype was built: what each step of my plan held, the issues I met and how I settled them, the errors and warnings the prototype handles on purpose, and what comes next. The design and the reasons for my choices are in `DESIGN.md`. The codes ("choice A", "next step B", "suggestion A") point there and to the [Notes](#5-notes) at the end of this file; a "choice" is always one of `DESIGN.md`.

**References to the brief.** The brief is the PDF "WeRoad take-home case - The assistant on the search page". It is not in this repository, so a reference is a location, not a link: "_Brief: §3 (p. 2), "Starts from the page"_" means section 3, on page 2, the bullet with that title. Sections 1 and 2 are on page 1, section 3 and the start of section 4 on page 2, and the rest of section 4 on page 3.

**Codes.** The design choices have letters (`DESIGN.md`, section 3): "choice A". The next steps and the suggestions for WeRoad have their own letters (`BUILD.md`, section 5): "next step B", "suggestion A".

**Other documents.** `UI_LAYOUT.svg`, `SEARCH_FUNCTION.svg` and `AGENT_GRAPH.svg` each show the plan on the left (`DESIGN.md`) and the prototype as built on the right (this file), so the differences are visible at a glance; `SEARCH_FUNCTION.md` and `AGENT_GRAPH.md` describe the search function and the agent as built, with the input, output and an example of each part.

## 1. Implementation

**How it was built.** I wrote the design (`DESIGN.md`) and chose the test cases from its business rules and the data's traps. A coding agent wrote the code and the unit tests to that spec, one step per commit. I reviewed each step, tested it by hand and ran the live eval; the issues below say which came from my reviews.

I worked in blocks. Each block has its own branch, `block-N-name`, and one pull request that I merged before the next block began, so each branch started from the merged `main`. Each step is one commit, and the commit message and its short hash are given with the step. Every step left `npm test` and `npm run typecheck` green, and every block ended with the production build. I developed on `claude-haiku-5-5`, the cheapest capable model, and mocked the model in every unit test. Versions are pinned exactly, and the key lives in `.env.local` (`.env.example` is committed).

### Block 0. Setup · `main`

Next.js, React, TypeScript, the Vercel AI SDK with its Anthropic provider, Zod and Vitest, with exact versions; the two data files copied into `data/` and never edited; `.env.example`; the repo layout (`lib/search`, `lib/page`, `lib/chat`, `lib/agent`, `app`, `components`, `tests`). Commit `b8ecca3` "Set up Next.js, AI SDK and Vitest". Checkpoint: `dev`, `test` and `build` run on an empty app.

### Block 1. Search function · `block-1-search`

The part with the most business rules, so the part tested hardest, on the real data (53 tests). It is described in `SEARCH_FUNCTION.md`, and `SEARCH_FUNCTION.svg` shows the plan beside the build. _Brief: §3 (p. 2), "Searches like the page does"._

| Step | Commit                                             | What it holds                                                                                                                                                                                                                                  |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.A  | `1a2df77` Add catalog loader and bookability rules | The data loaded; "today" is the constant 2026-10-16; a departure is bookable if it is upcoming and PLANNED, ALMOST_CONFIRMED, CONFIRMED or ALMOST_FULL, never from `seatsLeft`; the waiting list kept apart. Tests on the data's traps (the 5 past departures, the 129 NOT_AVAILABLE with seats left). |
| 1.B  | `dcc9141` Add mock API                             | Whole-word text match over title, destination, trip types, descriptions and itinerary; the filters, all holding on the same bookable departure; the data's order; the cheapest matching departure as the trip's price.                          |
| 1.C  | `f9da829` Add translator                           | Catalog destinations (a list), trip types and a max price read from the text; filler words dropped; a filter beats the same value in the text.                                                                                                   |
| 1.D  | `0e12d2b` Add search function                      | The translator and the mock API together: a search request in, the original search state and the results out, each result with the search state that found it. It leaves the place where the suggester plugs in (5.A).                          |

### Block 2. Bare page · `block-2-page`

The page refreshing is the core, so it came before the agent. The screen is drawn in `UI_LAYOUT.svg`, the plan beside the build. _Brief: §3 (p. 2), "Drives the page" and the guardrail on product clicks._

| Step | Commit                           | What it holds                                                                                                                                                                              |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.A  | `6970cc9` Add page state and history | The page state (search request, original search state, results) and the page history with push and undo, each entry tagged user or assistant. Pure functions, no server call for undo.     |
| 2.B  | `831dd91` Add search route       | `POST /api/search` calls the search function and returns a trimmed view of each result (no itinerary or description), with clear error messages.                                           |
| 2.C  | `b775c39` Add search page        | The page opens with "northern lights" already applied, run on the server by the same function. The search controls (bar, filters, Search, Undo) and the results list, each result linking to the trip's page. |
| 2.D  | `fc744b9` Add message box and chat shell | The message box for search errors, which closes by itself; a failed search keeps the last good results. The chat panel with only the start button.                                |

### Block 3. The agent with `search_trips` · `block-3-agent`

The core loop. After this block a deliverable-complete prototype existed: open the app, press start, say "max 2,000 euros", and the list changes to the search function's output. The agent is described in `AGENT_GRAPH.md` and drawn in `AGENT_GRAPH.svg`. _Brief: §3 (p. 2), "Starts from the page" and "Searches like the page does"._

| Step     | Commit                                                       | What it holds                                                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.A      | `48abe22` Add chat history and page blocks                   | The chat history entries; page events recorded as they happen and emptied into the next user message; the `<page_events>` and `<page_state>` blocks. Pure functions, with tests.                                                                              |
| 3.B      | `fa6c2f3` Add start button and first message                 | The start button fills the chat and disappears. The first assistant message is written by code from the page state: no model call and no new search.                                                                                                       |
| 3.C      | `349b971` Add agent route with search_trips                  | `POST /api/chat`: the system prompt, the AI SDK tool-calling loop (at most 5 steps, 30 seconds, one retry), the model from `.env.local`, and `search_trips`, which keeps, changes or drops parts of the request and runs the search function in the same step. |
| 3.D      | `144b06c` Add chat panel                                     | The input box, the messages, the stop and retry buttons; the agent's search applied to the page as an assistant change; the controls locked during a turn; an undo recorded as a page event; page change cards in the chat.                                   |
| 3.E      | `fadc4bd` Remove unused packages                             | `@ai-sdk/react` removed (the chat uses `fetch` and React state); the first live run with the real key, and the cost of a turn measured (two to five hundredths of a cent).                                                                                    |
| Follow-up | `98e4348` Record control changes as a page event            | After the step D review: a change in the controls that wasn't searched is a third page event, with a "Discard changes" button (see issue 11).                                                                                                                |

### Block 4. The other tools · `block-4-tools`

The data has nothing for promotions, flights or website pages, so those stay cut (next step L). Each tool's input, output and an example are in `AGENT_GRAPH.md`. _Brief: §3 (p. 2), "Picks the right tool"._

| Step | Commit                              | What it holds                                                                                                                                                                                                    |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.A  | `64f2e5c` Add get_departures        | The trips on screen and a date window in; the bookable departures with price and seats left, and the nearest before and after when none fits; notes for unconfirmed and waiting-list departures. Rules in code.   |
| 4.B  | `37611a9` Add get_faq               | My in-house retrieval: the general articles plus those of the destination asked about, by the FAQs' own fields, handed over verbatim. The agent answers only from them.                                            |
| 4.C  | `91a3293` Add hand_over             | The Yes/No question in the chat, written by code; Yes ends the chat, No closes the question; the call ends the turn.                                                                                              |
| 4.D  | `85aafed` Add get_itinerary and routing | The day-by-day plan of a trip on screen, and the routing rule in the system prompt: what changes goes to `search_trips`, when about the trips on screen to `get_departures`, how things work to `get_faq`.   |

### Block 5. Suggester and failure paths · `block-5-failures`

_Brief: §3 (p. 2), "Never a dead end, never a lie"._

| Step | Commit                           | What it holds                                                                                                                                                                                                                          |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.A  | `1f7fe50` Add suggester          | Runs only when the raw results are empty; loosens the search state one value at a time in a fixed order, within a fixed number of calls; every suggested result carries its own search state; at most 10, ordered by how little was loosened. |
| 5.B  | `42d4ad1` Add banner and search tags | "No exact matches. Closest options:" and the tags, computed on the client from how each result's state differs from the original.                                                                                                  |
| 5.C  | `4420c93` Handle model and tool failures | One place that turns a failed turn into a status and a message for the user; guarded tools; a stop that is silent; a page that stays usable whatever the model does.                                                           |
| 5.D  | `e629cbb` Warn about a chat draft on search | A search while the input box holds a message shows a warning in the message box and keeps the message.                                                                                                                       |

### Block 6. Small eval · `block-6-eval`

Two kinds of cases, because a mocked model can't show that the right tool is chosen. _Brief: §4 (p. 2), "how you would evaluate it before shipping"._

| Step | Commit                                  | What it holds                                                                                                                                                                                                                                              |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.A  | `e3a96b5` Add eval cases without a model | The cases the code decides, run in Vitest and cross-checked against the raw data ("USA", "northern lights", "New Year's Eve", "cooking class", "Brazil or Argentina end of September", 19–24 October…); strict checks, in code, on what an answer states (prices and dates), on FAQ answers and on a promised hand-over. |
| 6.B  | `06828ee` Add live eval script          | `npm run eval` plays 22 conversational cases against the real model, three runs each (69 turns), checks the tool called, the page state and the written answer, and writes the results to `evals/results/`. Three variants were measured: the baseline, lower reasoning and two prompt rules. A run costs about $0.08. |

### Block 7. Verify, then settle the gaps · `block-7-fixes`

| Step | Commits                                                                                                                                                                                                                                       | What it holds                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.A  | `8b63bbd` Replace a promised hand-over in code; fix prompt and tool wording · `05ac252` Fix eval checks: FAQ guarantee case, stale-trip check · `802a517` Record the final live eval run · `ad7fb86` Render the assistant's markdown · `7ee24fe` Show the nearest departure in the dates tag · `a6e4a9c` Fix the controls size and scroll results and chat inside the page · `9ed25bc` Treat a repeated search as no change | Verification: the tests, the typecheck and the production build; the core loop by hand against the real model; the final live eval; eleven manual tests against the brief's practical requirements. Each fix is one commit.                                                           |
| 7.B  | no commit                                                                                                                                                                                                                                     | The four gaps found by checking the design against the brief (product clicks, narrowing by words, risks, conversion) settled; where the build differs from my plan is shown in the three figures, the plan on the left and the build on the right.                                                                              |

At the end of block 7 the prototype has 360 tests passing, a clean typecheck, a production build, and a live eval of 22 cases.

## 2. Issues

Every issue I logged while building, in build order. Each has four parts.

- **Source:** where in the build it showed up, and how: an _implementation challenge_ (found while building), a _test_ (the unit tests or the offline eval cases), a _live run_ (the real model, in the live eval or by hand), or a _review_ (my review of a step, or my manual tests).
- **Issue:** what it is, without needing the brief.
- **Settlement:** how it was resolved.
- **Scope:** what it was about: the _conceptual design_ (a shortcoming or a gap in the plan), the _system prompt_ (or a tool description, which the model reads too), the _implementation logic_, the _evaluation_ (the checks themselves), the _data_, or _tooling and process_.

### Block 1

**1. The price shown for a trip could contradict the search**

- **Source:** step 1.B, an implementation challenge.
- **Issue:** each trip shows the price of its cheapest bookable departure. With "max €800" or a date window, the cheapest departure overall can fall outside the filters, so the list would show a price the search itself rules out.
- **Settlement:** the price is the cheapest bookable departure that matches the filters, computed by the mock API.
- **Scope:** conceptual design: the rule was written for a search without filters. _Brief: §3 (p. 2), "Never a dead end, never a lie" ("no invented trips, prices or dates")._

**2. The mock API cannot take a raw search request**

- **Source:** step 1.B, an implementation challenge.
- **Issue:** my definitions said the mock API takes a search request, but a destination list or a trip type can't be read from raw text without the translator, which my own diagram ran first.
- **Settlement:** the mock API takes a search state, the translator's output.
- **Scope:** conceptual design: a wording error in the definitions; the diagram was right. _Brief: §1 (p. 1), "understand → retrieve → filter → rank, exposed as one Search API"._

**3. A price suffix read as "thousand" in the wrong place**

- **Source:** step 1.C, an implementation challenge and a test. Writing the tests showed that without a word boundary the "k" of "kyrgyzstan" in "under 2000 kyrgyzstan" would read as 2,000,000. A separate slip, a stray control character in the regular expression, made "up to 2k" read as 2, and the tests caught it.
- **Issue:** the price phrase accepts "2k" and must not take a letter that begins another word.
- **Settlement:** "k" counts only when it ends a word; both cases are tested.
- **Scope:** implementation logic.

**4. "USA" finds Puerto Rico but not New York**

- **Source:** step 1.B (a test on the brief's own example), then step 6.B (the live eval found it in 9 of 9 runs).
- **Issue:** the data has one trip with destination "United States" (New York), and the word "USA" appears only in a Puerto Rico itinerary line, besides appearing inside "Busan" and "thousand". The search maps no abbreviations, so "USA" found the wrong trip.
- **Settlement:** whole-word matching removes Busan and "thousand" (step 1.B). The search deliberately stays free of aliases, and the agent, which understands intent, is told in the search tool's description to write the country as WeRoad names it ("United States", not "USA"). The live eval then found New York in all three runs.
- **Scope:** conceptual design (the cost of choice J: rules understand fewer phrasings), settled in a tool description the model reads. _Brief: §2 (p. 1), "'USA', 'northern lights', 'New Year's Eve'… the intent is not mapped"._

**5. Every result carried the whole trip**

- **Source:** steps 1.D and 2.B, an implementation challenge.
- **Issue:** a search result holds the entire trip, itinerary and description included. All 50 trips are 257 KB; the page needs neither the long texts nor every departure.
- **Settlement:** the search route sends a trimmed view of each result (the biggest search stays under 40 KB). In the chat, a user message stores the finished page context as a few hundred bytes of text instead of copying the page state into every request.
- **Scope:** implementation logic.

### Block 2

**6. Check scripts that broke, not the app**

- **Source:** steps 2.C, 3.D and others, implementation challenges.
- **Issue:** some of the coding agent's browser check scripts were wrong (a request handler registered twice, the `disabled` property read inside a disabled fieldset), so a check failed while the app was right.
- **Settlement:** each wrong check was fixed and run again, and the app turned out to be right every time.
- **Scope:** tooling and process.

### Block 3

**7. The page and the chat could disagree after the user used the page**

- **Source:** my review of step 3.B.
- **Issue:** the first assistant message says "3 trips". If the user ignores the chat and searches on the page, the page shows 1 trip while the message still says 3. My plan said page changes reach the agent without showing in the chat.
- **Settlement:** page changes show in the chat as cards: one card for each run of events, written in the user's voice ("You searched … → 2 trips"), no model call, and the source of the `<page_events>` block of the next user message. The first message stays true to when it was written.
- **Scope:** conceptual design: a shortcoming of the plan. _Brief: §2 (p. 1), the A/B lesson; §3 (p. 2), "Drives the page"._

**8. Does the model accept a conversation that starts with the code-written assistant message?**

- **Source:** step 3.A follow-up, a test on the real model, because the documentation doesn't say.
- **Issue:** the first message of the chat is written by code, so the conversation sent to the model could begin with an assistant message.
- **Settlement:** accepted by this model. The real rule is the other end: the conversation must end with a user message, because the model refuses assistant prefill. The chat route answers 400 when it doesn't, and the first assistant message is still left out of the model's input, which keeps the conversation valid on models that do reject it.
- **Scope:** implementation logic (an API constraint). _Brief: §3 (p. 2), "Starts from the page"._

**9. The SDK did not behave as the coding agent assumed**

- **Source:** step 3.C, an implementation challenge, found by reading the installed documentation and checking with a mocked model.
- **Issue:** the result of a turn's `response.messages` holds only the last step, so using it would have silently dropped every tool call and result. The names also differed from the ones the agent assumed (`instructions` for the system prompt, `isStepCount` for the step limit).
- **Settlement:** the turn's messages are the messages of all its steps together, and the code follows the installed documentation, not memory.
- **Scope:** implementation logic.

**10. The live model showed internal trip ids**

- **Source:** step 3.C, a live run ("One northern lights trip fits: #9 Iceland").
- **Issue:** the page state names trips by an internal id, which the model repeated to the user.
- **Settlement:** a rule in the system prompt: never show the ids, name a trip by its destination.
- **Scope:** system prompt.

**11. Control changes that weren't searched were invisible to the agent**

- **Source:** my review of step 3.D.
- **Issue:** a user who changes the controls but doesn't press Search and then writes to the chat leaves no trace: the page state is only what was searched, so the agent never learns of the edit, and its own search overwrites it.
- **Settlement:** a change in the controls is a third page event (only the last state is kept, never every keystroke), shown as a line in the card and given to the agent; a "Discard changes" button puts the controls back to the page's search without touching the undo history. Commit `98e4348`.
- **Scope:** conceptual design: a shortcoming of the plan. _Brief: §3 (p. 2), "Starts from the page" ("the applied filters")._

**12. The assistant named trips the search had just removed, with their old prices**

- **Source:** step 3.D, a live run; seen again in steps 4.A and 6.B, and measured by the eval.
- **Issue:** after "max 1,500 euros", the assistant wrote "Sweden (from €1,759) and Canada (from €2,539) are over the limit", with prices taken from an earlier page state, not the current page or a tool.
- **Settlement:** I measured before tightening. The strict reading is that a price or a date may come only from the page after the turn, this turn's tool results and the user's words (issue 29). The prompt rule was first "mention only trips the page shows now", which also blocked a good answer ("Canada dropped off because its price is above €2,000"); it is now "don't list or price a trip the page no longer shows; you may say which trips dropped off and why, without their prices". The check flags only a priced mention.
- **Scope:** system prompt, with the evaluation. _Brief: §3 (p. 2), "Never a dead end, never a lie"._

**13. Reasoning: cost, latency and the tool choice**

- **Source:** step 3.C (an observation), step 3.E (measured) and step 6.B (the live eval).
- **Issue:** the model reasons by default, and the reasoning signature travels back with each tool call (about 1.7 KB of history per tool turn). Would turning it down save money or time?
- **Settlement:** I kept the default. Lower reasoning cut reasoning tokens by 38% and cost by 5%, did not improve latency, and made the visa question lose a tool call in two runs. A turn costs between two and five hundredths of a cent; the input, not the reasoning, is nearly all of it.
- **Scope:** model configuration, not a design shortcoming. _Brief: §3 (p. 2), the measure "latency"._

### Block 4

**14. The "never write your own list of trips" rule contradicted a departures answer**

- **Source:** step 4.A, a live run.
- **Issue:** the prompt said not to list trips because the page shows them, yet the right answer to "I only have 19–24 October" is a short list of departures from the tool.
- **Settlement:** the rule was reworded: don't re-list the trips the page shows; listing the departures from this turn's tool result is the answer.
- **Scope:** system prompt. _Brief: §3 (p. 2), "Picks the right tool"._

**15. A departure that overhangs the date window**

- **Source:** step 4.A, an implementation challenge.
- **Issue:** my rules said "the nearest bookable departures before and after the window", and said nothing about a departure that starts inside the window and ends after it. Skipping it would have made the nearest option look weeks away.
- **Settlement:** it counts as "after", and the result says by how much ("ends 3 days after the window ends"). One function, `outsideBy`, measures how far a departure sticks out and is shared with the suggester.
- **Scope:** conceptual design: a rule left open. _Brief: §2 (p. 1), "people with fixed dates get a 'no' instead of the nearest option"._

**16. More than ten trips on screen**

- **Source:** step 4.A, a review.
- **Issue:** the page state lists at most 10 results, so a question about "all the trips on screen" covers only the first 10, and nothing told the agent there were more.
- **Settlement:** the tool's result carries how many trips are on screen and how many it checked, with a note when it covered only part. Covering all trips on a broad search is not built; it is a known limit of the prototype.
- **Scope:** implementation logic, with a limit of the design.

**17. Where the FAQ's "first booking pays nothing" belongs**

- **Source:** step 4.A, a review.
- **Issue:** the departures tool tells the agent that an unconfirmed departure is not yet confirmed, but the FAQ also says a first booking on one needs no payment. Which tool says what?
- **Settlement:** the tool reads what is and delivers it with its source, and doesn't choose for the user. The unconfirmed note quotes the help center's advice (wait for confirmation before buying flights); the "no payment" fact belongs to `get_faq`. Facts live in the tool results, built by code, not in the system prompt.
- **Scope:** conceptual design: the tools' roles. _Brief: §1 (p. 1), the chatbot "answers from FAQs"._

**18. The FAQ tool cannot decide that nothing covers a question**

- **Source:** step 4.B, an implementation challenge.
- **Issue:** my plan said "nothing covering the question returns nothing", which assumed a code check. The tool never sees the question, and a word match would make it worse: "visa" appears only in the payment article, as a card brand.
- **Settlement:** the tool returns the general articles and the destination's, and the agent judges from what comes back. The system prompt says to answer only from the articles and to say "I don't know" otherwise.
- **Scope:** conceptual design: the plan's wording did not fit its own retrieval choice (L). _Brief: §3 (p. 2), "Picks the right tool" ("'do I need a visa?' is a FAQ")._

**19. A hand-over turn that ended with no answer**

- **Source:** step 4.C, a live run: "Do I need a visa?" failed with "The agent ended its turn without an answer" in 6 of 14 tries.
- **Issue:** after the `hand_over` result the model often ends with an empty step, having written its sentence in the step that made the call, and the code looked only at the last step.
- **Settlement:** `hand_over` ends the turn, so there is no final step to be empty (and one fewer model call). In general the answer is the text of the last step that has any. A hand-over turn needs no sentence, since the question is the proposal.
- **Scope:** implementation logic. _Brief: §1 (p. 1), "hands over to a human agent in Zendesk when it should"._

**20. How the hand-over works in a prototype**

- **Source:** step 4.C, my review.
- **Issue:** the input while the question waits, what "no" means, whether the agent may offer again, and who takes over after "yes".
- **Settlement:** the input stays locked until the user answers. "Yes" is a practical halt, with nobody planned to take over (the real one is next step B); "no" replaces the card with the fact that the user said no, and the conversation goes on. The question is the proposal itself: it appears when the user asks for a person or when the agent can't answer.
- **Scope:** conceptual design: the stub was specified loosely. _Brief: §1 (p. 1), "hands over to a human agent in Zendesk when it should"; next step B._

**21. The model promises a connection that never happens**

- **Source:** step 4.C (3 of 7 sentences), then the eval in step 6.B (3 of 3 runs of "I want to talk to a person").
- **Issue:** the model writes "I'll connect you with a human agent", but nothing happens until the user answers Yes, and Yes only ends the chat.
- **Settlement:** measured first, then fixed in code in step 7.A: when the turn offered a human agent and the sentence promises the connection, the page shows "I can offer you a human agent." instead, and the question card follows. A rule in code, with a test, not a line in the prompt.
- **Scope:** system prompt behavior, fixed in the implementation. _Brief: §3 (p. 2), "Never a dead end, never a lie"._

**22. The itinerary tool answers only for trips on screen**

- **Source:** step 4.D, a live run.
- **Issue:** asked about a trip that isn't on the page, the agent could answer from nothing the user can see, which would break "the page and the chat never disagree".
- **Settlement:** like `get_departures`, it works from the trips on screen; for others the agent says so and offers to search for them.
- **Scope:** conceptual design: the tool table said "a trip".

### Block 5

**23. Rules of the suggester that my plan left open**

- **Source:** step 5.A, implementation challenges.
- **Issue:** "loosen one value at a time" said nothing about the text as one value, about the order of the list, or about a cap. "Hiking in Brazil or Argentina" must give Patagonia, and "all trips for 19–24 October" would list all 50 trips.
- **Settlement:** each value is dropped alone, and several together (a prefix of the fixed order) only if every single drop is empty; the text counts as three values, loosened last, in this order: the words, the trip types, the destinations; results are ordered by fewest values loosened, then the fixed order, then the distance (price over, days outside the dates or the duration); a trip found twice is listed once; at most 10.
- **Scope:** conceptual design: rules left open. _Brief: §3 (p. 2), "Never a dead end"._

**24. The agent misdescribed what was loosened**

- **Source:** step 5.A, a live run.
- **Issue:** the page state said only "loosened: search words", so the agent called the Argentina trip "not a hiking-specific match", unable to tell that "brazil" was the unmatched word.
- **Settlement:** the page state names each loosened value together with what was asked ("loosened: the words "hiking brazil end september""), and the prompt says to state plainly that nothing matches exactly and what was loosened.
- **Scope:** implementation logic (the page-state block), with the system prompt.

**25. Slips that no check catches**

- **Source:** step 5.A (a live run), seen again in the hand review of step 7.A.
- **Issue:** a miscounted result ("the other six results" when there were five) and an invented distinction ("the only one under budget that involves walking" when all had matched "hiking").
- **Settlement:** a hand review of the live answers (one miscount in the 21 suggestion answers), and both kinds named as unchecked. A model judge would need its own validation (next step A).
- **Scope:** model behavior, beyond what the evaluation covers.

**26. The tags and the banner**

- **Source:** step 5.B (a review), then step 7.A (my manual test).
- **Issue:** the tag for loosened dates ("no departure inside your dates") gave no sign of how close the trip was, while the other tags state the result's own value next to what was asked ("€4,169 · above your €2,000").
- **Settlement:** the banner "No exact matches. Closest options:" replaces the count above the results. The dates tag now names the trip's nearest bookable departure: "nearest departure 20–27 Oct · outside your 19–24 Oct".
- **Scope:** conceptual design and implementation: the plan's example covered only the price tag. _Brief: §3 (p. 2), "Never a dead end" ("the nearest options and the reason")._

**27. A failed tool leaked its message, and one error message was not enough**

- **Source:** step 5.C: checks with a mocked model, then the real server with a wrong key.
- **Issue:** a tool that throws gives the model the raw exception text, and a timeout, an overloaded provider and a bad key call for different words to the user.
- **Settlement:** one function, `describeFailure`, maps each failure to a status and a message written for the user, and none leaks a detail (see [Handled Errors](#3-handled-errors)); every tool is guarded, and a failed `search_trips` leaves the page as it was; a stop is silent and not logged. Checked live: wrong key, a real stop, a failing tool.
- **Scope:** implementation logic: the design's Errors section did not list the causes. _Brief: §3 (p. 2), "Never a dead end" ("it degrades gracefully and says so")._

**28. The warning for an unsent chat message, after an undo**

- **Source:** step 5.D, my review.
- **Issue:** my plan named only a search as the moment to warn, but an undo also changes the page while a message waits in the input.
- **Settlement:** the warning shows after a successful search and after an undo, not after "Discard changes" (nothing changed on the page). A failed search shows its error instead, and the message is kept either way.
- **Scope:** conceptual design: choice O named only the search. _Brief: §2 (p. 1), the A/B lesson ("help the page, not replace it")._

### Block 6

**29. What may a price or a date in an answer come from?**

- **Source:** step 6.A, designing the checks.
- **Issue:** after issue 12 the question was whether an answer may repeat anything in the conversation (lenient) or only what is current (strict).
- **Settlement:** strict: the page as it is after the turn, what the tools returned this turn, the user's own words, and today's date (the system prompt states it). A derived figure counts as not stated and is reviewed by hand. The checks are patterns in code, not a model judge.
- **Scope:** evaluation. _Brief: §4 (p. 2), "how you would evaluate it before shipping"._

**30. Faults in the eval's own checks**

- **Source:** steps 6.B and 7.A, the live eval: reading the failures showed the check was wrong, not the model.
- **Issue:** the "says nothing matches exactly" pattern was too narrow ("I didn't find an exact match", "No Japan trip matches"); today's date was flagged as an ungrounded date; the New Year's Eve case demanded a search where looking at departures is as defensible; the date pattern read the end of a year as the start of a range ("2026 and 5 January" gave "26 January"); and the case that forbade a PayPal or Revolut guarantee for an unconfirmed booking was wrong, because the help center's article 4 says "a credit card, PayPal, or Revolut as a guarantee" while article 7 says only a card.
- **Settlement:** each check was fixed and tested; the New Year's Eve case now accepts either tool, which I disclose as a goalpost moved after seeing a failure; the guarantee case forbids nothing, and the contradiction between the articles goes to the suggestions for WeRoad (B).
- **Scope:** evaluation, and the data: the help center contradicts itself. _Brief: §4 (p. 2), "how you would evaluate it before shipping"._

### Block 7

**31. The visa question sometimes skips the help center**

- **Source:** step 7.A, the final live eval (1 of 3 runs; also with lower reasoning).
- **Issue:** the agent called `hand_over` without `get_faq` first. The user still gets the same offer of a person, but the route is wrong.
- **Settlement:** left as a measured limit: a rule "always call `get_faq` before `hand_over`" would be a fourth prompt rule for a one-in-three case that does no harm.
- **Scope:** system prompt, model behavior.

**32. The strict check has false positives**

- **Source:** step 7.A, the final live eval.
- **Issue:** "several start below €1,000" (a threshold the model chose) and "31 December" (the model translating "New Year's Eve") are flagged as ungrounded.
- **Settlement:** left alone. A false positive costs a look; a looser check could let a wrong price through.
- **Scope:** evaluation.

**33. The assistant's markdown was shown as typed**

- **Source:** step 7.A, my manual test.
- **Issue:** the assistant writes lists and bold text, and the chat showed `**Iceland**` and `- ` on one line.
- **Settlement:** a small component renders paragraphs, lists and bold as React elements, never as HTML, so a message cannot add markup to the page. Tested with the model's own list and with a message containing markup.
- **Scope:** implementation logic (the interface).

**34. The controls changed size and the whole page scrolled**

- **Source:** step 7.A, my manual tests.
- **Issue:** the filters wrapped, and a date input grows once it is filled, so the controls changed height while typing; the window scrolled as a whole, and the chat sat at a fixed height.
- **Settlement:** the filters are one grid row of fixed columns. The app is as tall as the window; the controls keep their height, and the results and the chat share the rest at two to one, each scrolling inside its own pane. A narrow window stacks the parts and scrolls as a whole.
- **Scope:** implementation logic (the layout).

**35. Searching the same request again added an undo step**

- **Source:** step 7.A, my manual test.
- **Issue:** pressing Search with the controls the chat had just set changed nothing on the page, yet Undo then "went back" to the same state.
- **Settlement:** a search that repeats the page's search is not a change: no history step, no card, no warning, and the same for the agent's searches.
- **Scope:** implementation logic: a history rule the design didn't state. _Brief: §3 (p. 2), the measure "how often users undo what it did"._

### Process

**36. A first push without an upstream**

- **Source:** step 4.D, the push of block 4.
- **Issue:** the push commands the coding agent gave me ended with a plain `git push`, which fails for a branch that has never been pushed, so the pull request failed too ("No commits between main and block-4-tools"). Nothing was lost.
- **Settlement:** `git push --set-upstream origin <branch>` for the first push of a branch; a plain push only after.
- **Scope:** tooling and process.

## 3. Handled Errors

What can fail, and what the user sees. A failure never changes the page: a failed search keeps the last good results, and a failed turn leaves the page fully usable. _Brief: §3 (p. 2), "Never a dead end" ("when something fails, it degrades gracefully and says so")._

### The search button

It shows its error in the message box under the title "Search failed", and the message box closes itself after a few seconds.

- **The request isn't valid JSON** (400): "The search request wasn't valid JSON."
- **The search isn't valid** (400): "The search isn't valid." and the first problem, for example a start date after the end date, a price that isn't positive or a search text over 200 characters.
- **The search function throws** (500): "The search failed. Please try again." The detail goes to the server log only.
- **The server can't be reached:** "Couldn't reach the server. Check your connection and try again."

### The chat

It shows its error in the chat as an error message with a retry button, and the retry sends the same message again. The controls and the page stay usable. An error is kept in the chat history but is never sent to the model.

- **The request isn't valid JSON, isn't a valid chat history, or is too long** (400): "The chat request wasn't valid JSON." or "The chat request isn't valid." (at most 200 entries).
- **The history doesn't end with a user message** (400): "The chat must end with a user message." The models refuse a conversation that ends with the assistant.
- **The turn takes longer than 30 seconds** (504): "The assistant took too long to answer. Please try again."
- **The turn ends without an answer** (502): the model's last step was empty and no earlier step had a sentence, or the five-step limit came first. "The assistant couldn't finish its answer. Please try again."
- **The provider is rate limiting, overloaded or failing** (503): a 429 or a 5xx, after the one automatic retry. "The assistant is busy right now. Please try again in a moment."
- **Anything else** (500): a bad or missing key (`ANTHROPIC_API_KEY is not set` is raised when there is none), a missing setting or a bug. "The assistant isn't available right now. Please try again later."
- **The user presses stop** (499): nobody is waiting, so there is no message from the server and nothing is logged. The chat says "You stopped this answer."
- **The server can't be reached:** "Couldn't reach the server. Check your connection and try again."
- **The answer isn't JSON:** "The assistant couldn't answer. Please try again."

### The tools

The agent is told what went wrong and tells the user, instead of guessing. The prompt says: when a tool returns an error, say plainly that you couldn't get that right now and that they can try again.

- **A tool throws** (any of the five): the detail goes to the server log, and the agent receives only "<tool> failed: its result is not available right now." A failed `search_trips` leaves the page as it was.
- **The model sends an invalid tool input:** the validation message goes back to the model as the tool's error so that it can correct itself. For example `get_departures` with only one end of the date window ("Send both from and to, or neither.") or a start date after the end date.

## 4. Handled Warnings

What the user is warned about, and what the agent is told to warn about. A warning is not an error: nothing failed, but something the user might not expect has happened. _Brief: §3 (p. 2), "Never a dead end, never a lie"; §2 (p. 1), the A/B lesson._

### On the page and in the chat

- **A chat message was left unsent:** a search or an undo changed the page while the input box held a message that could be sent. The message box shows "Your chat message wasn't sent. Press send to ask the assistant." for a few seconds, and the message stays in the input. It doesn't show for "Discard changes", for an empty or blank message, or when the input is locked (a turn is running, a question waits, the chat has ended).
- **The results are not exact matches:** no trip matches the search, so the page shows the closest options under "No exact matches. Closest options:", each with tags saying what differs from the search (a price over the limit, another destination, no departure inside the dates, a duration outside the range, and so on).
- **The hand-over question is waiting:** the input is locked ("Yes or No above") until the user answers, so the user can't miss it.

### What the tools tell the agent to say

The notes come from code, built for each call, not from the prompt.

- **A departure isn't confirmed yet** (PLANNED or ALMOST_CONFIRMED): WeRoad is waiting for more bookings, and its help center advises waiting for confirmation before buying flights.
- **A departure is on the waiting list:** a seat is not guaranteed, nothing is known about how the waiting list works, and a bookable departure should be offered next to it, leaving the choice to the user.
- **Only part of the trips on screen was checked:** "Only the first 10 of the 50 trips on screen were checked, in the page's order."
- **A trip isn't on the page** (for departures or the itinerary): the agent says so and offers to search for it.
- **There is no help-center article for a destination,** or the destination isn't one WeRoad has a trip to: only the general articles apply.
- **An itinerary is shorter than the trip:** 11 itineraries list fewer days than the trip lasts, and the note says "The itinerary lists N of the trip's M days."
- **Nothing matches exactly after a search by the agent:** the prompt tells it to say plainly that nothing matches exactly and what was loosened, and not to present the results as matches.

## 5. Notes

What comes after the prototype, and what WeRoad could change on its side. The letters in brackets, such as "(choice D)", point to the design choices in `DESIGN.md`; "step A" and the like point to the next steps below.

### Next Steps

What the prototype leaves out on purpose or builds in a simpler form, why, and what comes next, in rough order of value. The cuts with no next step are listed last.

**A. Evaluation before shipping.** A scripted set of conversations built from the data's traps ("USA", "I only have 19–24 October", "New Year's Eve", "cooking class", "do I need a visa?"), checked offline on every change: the right tool called, the page state as expected, no invented prices or dates. Then an A/B test on the brief's metrics (the share of searches that open the assistant, their conversion, the undo rate, the zero-result share, latency), with SERP engagement as the guardrail. _Brief: §3 (p. 2), the paragraph on success; §4 (p. 2), "how you would evaluate it before shipping"._

**B. A real hand-over.** In the prototype, Yes freezes the chat. The real hand-over swaps the model for a person: everything else stays the same. The person joins the same chat, reads the same chat history (with the page state at each user message) and can drive the page through the same tools. The user sees no change in how the chat works, and nothing is lost in the switch. _Brief: §1 (p. 1), "hands over to a human agent in Zendesk"._

**C. Error storage.** Search errors are only shown in the message box today, and agent errors only in the chat history on the client. Storing all errors on the server would show what fails and how often, and would feed the evaluation set (step A).

**D. Histories on the server, and surviving a reload** (choice D). Both histories live on the client, so a reload loses them. Next, keep them in a session store on the server, keyed by a session id: smaller requests, conversations kept for evaluation, and a reload that loses nothing. Browser session storage is the cheaper fix for the reload alone.

**E. A cap on the history sent to the model** (choice B). Long conversations raise the cost per turn. Send the model only the latest turns plus a short summary of the earlier ones; the latest page state is always in the latest user message.

**F. WeRoad's classifier instead of the translator** (choice H). The translator uses rules, since WeRoad's classifier is coming. When "Smart filters" ships, it replaces the translator and nothing else changes: the search function keeps its input and output. _Brief: §1 (p. 1), "A classifier will soon pre-fill filters"._

**G. Suggestions when results are few** (choice I). Today suggested results appear only when there are none. If users often get one or two results and leave, add suggestions below a threshold.

**H. Narrowing by meaning** (choice M). Narrowing through search works only for words in the trip's text. For meaning ("vegan food", "good for a first trip"), a `narrow_results` tool where the agent reads the results and picks a subset, which the list then shows.

**I. Changes during a turn** (choice N). Instead of locking the controls while the agent works, apply the agent's change only if the page state is still the one the turn began with, and say so in the chat when it isn't. The page stays usable during long turns.

**J. Redo** (choice C). Cut because the brief asks only for undo. Next, a second button that steps forward in the page history, which is cheap with the page history in place.

**K. A real RAG for the FAQs** (choice L). My retrieval works because the FAQs I was given are 50 articles with a destination field. WeRoad's real help center is surely larger, and its sites run in five markets. There, picking by field stops working: retrieve by meaning (embeddings), in the user's language, and keep the rule that the agent answers only from what was retrieved. _Brief: §1 (p. 1), "its websites (IT, ES, FR, DE, .com)"._

**L. Tools not implemented.** The engine's tools named in the brief that the prototype leaves out, because the data has nothing for them: `get_web_page` (WeRoad's website pages), `get_promotions` (the only related fact in the data: 75 departures carry a pre-discount price) and `get_flight_prices`. Plus one that the brief's behaviors suggest: `narrow_results` (step H). _Brief: §3 (p. 2), "Picks the right tool"; "Out of scope" (p. 2)._

**M. Tracing.** The prototype has no tracing platform, to keep the stack small. Next, each turn's model calls, tool calls, tokens and latency in one trace, to debug a bad answer and to measure cost and latency against the brief's metrics.

**Cuts with no next step**

- **Ending the chat:** closing the tab is enough (choice B).
- **A model-written first message:** code writes it from the page state, free and instant (choice A).
- **Asking the user to approve each page change:** undo makes changes cheap to reverse.
- **Languages and markets:** the data is one market, in English.
- **Login:** cross-session memory is out of scope in the brief (§3, p. 2).
- **Deployment:** a prototype run locally is enough for the brief (§4, p. 3).
- **LangGraph and reflection:** a single tool-calling loop has nothing for them to add.
- **Ranking changes:** out of scope in the brief (§3, p. 2).
- **A polished UI:** the brief doesn't expect one (§4, p. 3).
- **Different filters per destination** ("Iceland in December or Morocco in March"): a search state holds one set of filters for all its destinations. It is rare, and the user can ask for the two searches one after the other.

### Suggestions for WeRoad

Changes on WeRoad's side that the prototype points to.

**A. A fuller Search API.** The Search API should return, with the results, the search state it understood and, when the results are empty, suggested results, each with its own search state (the full API in choice H). Why:

- **The page benefits too, without the chat.** 17% of text searches return nothing, and most users never open a chat. _Brief: §2 (p. 1)._
- **One behavior everywhere.** The site, the apps and the chatbot would get the same suggestions, so channels never answer differently. _Brief: §2 (p. 1), "site and chatbot can answer the same question differently"._
- **Better suggestions, faster.** Next to retrieval and ranking, suggestions take one call instead of a loop of calls, and are ranked with the same signals as the results.
- **The user sees what was understood.** Every page could show the search state and let the user correct it.
- **A smaller assistant.** The translator and the suggester would leave the assistant's code.

**B. One wording for sales statuses.** The FAQ explains an "Open to book" status that doesn't exist in the data, which has seven statuses of its own. One table from sales status to what the user is told, used by the site, the chatbot and the FAQ, keeps every channel saying the same thing. _Brief: §2 (p. 1), the same-question-different-answers bullet._