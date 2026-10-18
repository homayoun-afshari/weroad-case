# Agent

This describes the agent as built, beyond what `AGENT_GRAPH.svg` already shows. The figure draws the loop, its limits, the five tools, the routing rule and the failure statuses, with the plan on the left and the prototype on the right. This file holds the rest: what goes in and out of a turn, what the model reads, and for each tool its input schema, its output schema and an example. The reasons for the design are in `DESIGN.md`.

**References to the brief.** The brief is the PDF "WeRoad take-home case - The assistant on the search page". It is not in this repository, so a reference is a location, not a link: "_Brief: §3 (p. 2), "Starts from the page"_" means section 3, on page 2, the bullet with that title. Sections 1 and 2 are on page 1, section 3 and the start of section 4 on page 2, and the rest of section 4 on page 3.

**Codes.** The design choices have letters (`DESIGN.md`, section 3): "choice A". The next steps and the suggestions for WeRoad have their own letters (`BUILD.md`, section 5): "next step B", "suggestion A".

## The agent in one paragraph

One tool-calling loop with the Vercel AI SDK's `generateText`: no reflection, no graph, and no memory of its own. The server keeps nothing between turns; the client sends the chat history with every request, and the agent works from it (choices D and E). The code is in `lib/agent/` (`prompt.ts`, `tools.ts`, `turn.ts`, `errors.ts`, `promise.ts`, `model.ts`) and the route is `app/api/chat/route.ts`. The agent decides **what** to keep, change or drop in the search, **which** tool answers a question, and **what to say**. It never decides a business rule: what can be booked, what counts as a match and how an empty search is loosened are in code, behind the tools. _Brief: §4 (p. 2), "where the business rules live"._

## What goes in

```ts
interface ChatRequest {
  entries: ChatEntry[];   // the chat history, oldest first, ending with a user entry (at most 200)
  onScreen: number[];     // the trip ids on the page, in the page's order (at most 100)
}
```

A `ChatEntry` is one of: `user` (the text the user wrote, and the `blocks` of page context the model reads before it), `assistant`, `tools` (the tool calls and results of a turn, kept for the next turn), `page` (a card of page events, never read by the model), `handover` (`asked`, `yes` or `no`) and `error` (kept for counting, never sent to the model). The route checks the shape and that the history ends with a user message, because the model refuses a conversation that ends with the assistant.

### What the model reads

- **The system prompt** (`prompt.ts`): the role (the assistant on WeRoad's search results page) and today's date; what the two page blocks are; which tool to pick for what; the rules on honesty. The business rules are not in it. _Brief: §3 (p. 2), "Starts from the page"._
- **The history,** as messages. Every user message begins with the blocks the page wrote, then the user's words:

  ```text
  <page_events>
  user searched "northern lights" · max price €2,000 (2 results)
  </page_events>
  <page_state>
  search: "northern lights" · max price €2,000 · dates: none
  results (2): #9 Iceland (8 days, from €1,219), #11 Sweden (7 days, from €1,759)
  </page_state>
  I only have 19–24 October
  ```

  The page state lists at most 10 results and says "first 10 shown" when there are more. When the results are the closest options, it says so, and each trip says what was loosened and what was asked.
- **The tool calls and results of earlier turns,** so a follow-up ("and the second one?") can use what was fetched.
- **Not** the page history, the page cards or the errors.

### The rules the prompt gives

Prices, dates and trips come only from the page state and the tool results, and the agent never lists the trips the page already shows (it does list the departures `get_departures` returns). It doesn't list or price a trip the page no longer shows, but it may say which trips dropped off and why. Help-center answers come only from the articles `get_faq` returns, and "I don't know" is the answer when none covers the question. It never shows the `#` ids. After a search it says in a sentence or two what changed and how many trips are shown, and when the page says there are no exact matches, it says so plainly and what was loosened. When a tool returns an error, it says it couldn't get that right now. It doesn't point to other contact channels. When no trip on screen fits a date window, it doesn't search again on its own: it offers to look at all trips for those dates, and a yes becomes a `search_trips`. Undo is not a tool: asked to go back, it forms the earlier request with `search_trips` (choice G). _Brief: §3 (p. 2), "Never a dead end, never a lie"._

## What comes out

```ts
interface TurnResponse {
  entries: ChatEntry[];   // a `tools` entry (the calls and results), the assistant's message, and a `handover` entry when it offered a person
  page: PageState | null; // the page after the last search of the turn, if there was one
}
```

The client appends the entries and applies the page as the assistant's change. The answer is the text of the last step that has any: after a tool the model sometimes ends with an empty step, having written its sentence together with the call. A hand-over turn needs no sentence, since the question card is the proposal; when the sentence promises the connection ("I'll connect you with a human agent"), the page shows "I can offer you a human agent." instead, because nothing happens until the user answers Yes (`promise.ts`). A failed turn is an error with a status and a message for the user (`errors.ts`; see "Handled Errors" in `BUILD.md`) and changes nothing on the page.

## Sizes and cost

| What                               | Value                                              | Where                |
| ---------------------------------- | -------------------------------------------------- | -------------------- |
| Results listed in a page state     | 10                                                 | `lib/chat/blocks.ts` |
| Trips in a `get_departures` answer | 10; 5 departures for each trip                     | `departures.ts`      |
| Trip ids in `get_departures`       | 10                                                 | `schema.ts`          |
| Search text                        | 200 characters                                     | `schema.ts`          |
| FAQ destination                    | 60 characters                                      | `schema.ts`          |

A turn costs two to five hundredths of a cent on `claude-haiku-5-5` and takes one to three seconds, measured. A turn with no tool sends about 1,700 input tokens (the prompt, the tool schemas, the page blocks) and one `get_faq` adds about 3.5K; the input, not the reasoning, is nearly all of the cost.

## The tools

Input that doesn't fit a schema goes back to the model as the tool's error, so it can correct itself. _Brief: §3 (p. 2), "Picks the right tool" ("trip search, a trip's departures, the itinerary, FAQs, website pages, promotions, flight prices and hand-over to a human")._

### `search_trips`

Runs a new search on the page and updates the results list. The agent sends the **complete** new request: what the user still wants, what they asked to change, and none of what they dropped. It runs the search function (`SEARCH_FUNCTION.md`) in the same step, so the page and the answer come from the same results (choice G). _Brief: §3 (p. 2), "Searches like the page does" and "Drives the page"._

**Input** (`searchRequestSchema`, also the search button's request):

```ts
{
  text: string;                                   // at most 200 characters; destinations in plain words ("United States", not "USA"); not prices or dates
  dates?: { from: string; to: string };           // ISO dates; a departure must lie fully inside; from <= to
  maxPrice?: number;                              // euros, positive
  days?: { min?: number; max?: number };          // trip length, positive integers
  ageBand?: "18-25" | "25-35" | "25-49";
  physicalRating?: "LOW" | "MEDIUM" | "HIGH";
  privateRoom?: boolean;
}
```

**Output:** the `<page_state>` block of the new page, in the format the model already reads (a string). The client receives the page state itself in `TurnResponse.page`.

**Example.** The user says "Something cheaper, max 1,500" with the Northern Lights page on screen.

```text
call:   search_trips({ "text": "northern lights", "maxPrice": 1500 })
result: <page_state>
        search: "northern lights" · max price €1,500 · dates: none
        results (1): #9 Iceland (8 days, from €1,219)
        </page_state>
said:   "I've set the maximum price to €1,500. One trip fits: the 8-day Iceland trip, from €1,219."
```

### `get_departures`

The departures of the trips on screen, with price and seats left, and the nearest bookable ones when none fits the window. The rules are in code: only upcoming, bookable departures are offered, and a window matches departures that lie fully inside it (choice K). _Brief: §2 (p. 1), "people with fixed dates get a 'no' instead of the nearest option"; §3 (p. 2), "Picks the right tool"._

**Input** (`departuresInputSchema`):

```ts
{
  tripIds?: number[];   // 1 to 10 of the # ids; leave out for all the trips on screen
  from?: string;        // ISO date; send with `to`, or leave both out
  to?: string;          // ISO date; from <= to
}
```

**Output** (`DeparturesResult`):

```ts
{
  window: { from: string; to: string } | null;
  trips: {
    tripId: number; destination: string; title: string;
    departures: DepartureView[];        // bookable, by date; inside the window, or the next ones; at most 5
    omitted: number;                    // how many more there are
    waitingList: DepartureView[];       // a seat is not guaranteed
    nearestBefore: OutsideWindow | null; // only when no trip on screen fits the window
    nearestAfter: OutsideWindow | null;
  }[];
  notOnScreen: number[];                // requested ids that are not on the page
  tripsOnScreen: number; tripsChecked: number;
  noTripFitsWindow: boolean;
  notes: string[];                      // to relay: unconfirmed, waiting list, only the first trips checked
}
// DepartureView: { id, startingDate, endingDate, priceEur, fullPriceEur | null, seatsLeft,
//                  status, confirmed, ageBand, privateRoomBookable }
// OutsideWindow: DepartureView & { how: string }   // "ends 3 days after the window ends"
```

**Example.** "I only have 19–24 October" with Iceland, Sweden and Canada on screen.

```text
call:   get_departures({ "from": "2026-10-19", "to": "2026-10-24" })
result: { window: { from: "2026-10-19", to: "2026-10-24" }, noTripFitsWindow: true,
          tripsOnScreen: 3, tripsChecked: 3,
          trips: [ { tripId: 9, destination: "Iceland", departures: [], waitingList: [],
                     nearestBefore: null,
                     nearestAfter: { id: "9-1", startingDate: "2026-10-20", endingDate: "2026-10-27",
                                     priceEur: 1599, fullPriceEur: 1869, seatsLeft: 2,
                                     status: "ALMOST_FULL", confirmed: true,
                                     how: "ends 3 days after the window ends", … } }, … ],
          notes: ["Not confirmed yet: WeRoad is waiting for a few more bookings. … (article 7). Tell the user."] }
said:   "None of the three trips has a departure fully inside 19–24 October. The nearest ones are: …"
```

### `get_itinerary`

The day-by-day plan of one trip on screen, as the data has it. _Brief: §3 (p. 2), "Picks the right tool" ("the itinerary")._

**Input** (`itineraryInputSchema`): `{ tripId: number }`, the `#` id in the page state.

**Output** (`ItineraryResult`):

```ts
{
  tripId: number;
  onScreen: boolean;                 // false when the trip is not on the page: nothing else is returned
  destination?: string; title?: string; numberOfDays?: number;
  days: { day: number; title: string; nights: string | null; highlights: string[] }[];
  notes: string[];                   // "The itinerary lists 7 of the trip's 8 days." (11 of the 50 trips)
}
```

**Example.** "What do we do on day 2 in Iceland?"

```text
call:   get_itinerary({ "tripId": 9 })
result: { tripId: 9, onScreen: true, destination: "Iceland", numberOfDays: 8,
          days: [ { day: 1, title: "Welcome to Iceland: check-in in Reykjavik", nights: null, highlights: ["Reykjavik"] },
                  { day: 2, title: "Snaefellsnes Peninsula and Kirkjufell by night", nights: null, highlights: ["Kirkjufell"] }, … ],
          notes: [] }
```

### `get_faq`

My in-house retrieval over the help center's FAQs: the general articles and the article of the destination asked about, picked by the FAQs' own fields and handed over verbatim (choice L). It can't decide that nothing covers a question, because it never sees the question: the agent judges from the articles, and the prompt says to answer only from them. _Brief: §1 (p. 1), the chatbot "answers from FAQs"; §3 (p. 2), "Picks the right tool" ("'do I need a visa?' is a FAQ")._

**Input** (`faqInputSchema`): `{ destination?: string }`, at most 60 characters, as named in the page state; leave out for a general question.

**Output** (`FaqResult`):

```ts
{
  destination: string | null;        // as given
  articles: { id: number; scope: "general" | "destination"; destination: string | null; title: string; body: string }[];
                                     // the destination's article first, then the 15 general ones
  notes: string[];                   // no article for that destination, or not a destination WeRoad has a trip to
}
```

**Example.** "What's the weather in Iceland?"

```text
call:   get_faq({ "destination": "Iceland" })
result: { destination: "Iceland",
          articles: [ { id: 34, scope: "destination", destination: "Iceland",
                        title: "What’s the weather like in Iceland?", body: "Iceland's weather is famously unpredictable… South Iceland: …" },
                      … 15 general articles … ],
          notes: [] }
call:   get_faq({ "destination": "Sweden" })   // notes: ["There is no help-center article for Sweden; only the general articles apply."]
```

### `hand_over`

Offers the user a human agent, when the user asks for one or when the agent can't answer. The tool only marks that the question should be asked; the page asks "Do you want to connect to a human agent?" with Yes and No, and the text is written by code. **The call ends the turn.** In the prototype, Yes ends the chat and No closes the question; the real hand-over is next step B. _Brief: §1 (p. 1), "hands over to a human agent in Zendesk when it should"._

**Input:** `{}`. **Output:** the string "The page will now ask the user whether they want to connect to a human agent."

**Example.** "Do I need a visa?" Visas appear in no help-center article, except as a card brand.

```text
call:   get_faq({})   → the general articles; none covers visas
call:   hand_over({})
said:   "I can't find visa information in WeRoad's help articles, so I can't answer that here. I'll offer to connect you with a human agent."
page:   [Do you want to connect to a human agent?  (Yes) (No)]   the input is locked until the user answers
```
