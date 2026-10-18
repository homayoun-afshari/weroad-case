# The assistant on the search page

My take-home case for WeRoad: a chat assistant beside a trip search page. The page opens with a search already applied. The assistant turns what the user says into a new search through the same search function the page uses, updates the results list, and answers departure, itinerary and FAQ questions with its other tools. The page never depends on the chat.

The write-up (two pages) is [docs/WRITE_UP.pdf](docs/WRITE_UP.pdf).

## Preparations

- **Node.js 20.9 or newer** (developed on 24) and npm.
- An **Anthropic API key**, only for the chat and the live eval. The page and its search work without one.

```bash
npm install
cp .env.example .env.local     # then put your key in ANTHROPIC_API_KEY
```

`.env.local` is not committed. `ANTHROPIC_MODEL` is optional and defaults to `claude-haiku-5-5`, the cheapest capable model.

## Commands

| Command             | What it does                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Starts the app at http://localhost:3000.                                                             |
| `npm test`          | Runs the 360 unit tests (Vitest). The model is mocked, so it costs nothing and needs no key.         |
| `npm run typecheck` | Type-checks the whole repo.                                                                          |
| `npm run build`     | Builds for production; `npm start` then serves it.                                                   |
| `npm run eval`      | The live eval: 22 conversations against the real model, three runs each. About $0.08 a run.         |

For the live eval, `EVAL_VARIANT` (`baseline`, `low-reasoning`, `rules`) and `EVAL_RUNS` (default 2) choose what is measured; the results go to `evals/results/`.

## Where things are

| Folder        | What is in it                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `app/`        | The page, and the two routes: `POST /api/search` (the search button) and `POST /api/chat` (a turn). |
| `components/` | The screen: search controls, results list, chat, message box.                                    |
| `lib/search/` | The search function: translator, mock API, suggester, and the departures, FAQ and itinerary tools' logic. |
| `lib/page/`   | The page state, its history (undo), the form and the search tags.                                |
| `lib/chat/`   | The chat history, the page events and blocks the agent reads, the client.                        |
| `lib/agent/`  | The system prompt, the five tools, one turn, the failure messages.                               |
| `tests/`      | Unit tests, on the real data; the model is mocked.                                               |
| `evals/`      | The checks on answers, the live cases and the runner, and the results of the runs.               |
| `data/`       | WeRoad's two JSON files, as given.                                                               |
| `docs/`       | The documents below.                                                                             |

**One request, end to end.** Press Send in the chat: `components/SearchApp.tsx` posts the history to `app/api/chat/route.ts`, which calls `runTurn` in `lib/agent/turn.ts`; the model calls a tool from `lib/agent/tools.ts`, which for a search calls `search()` in `lib/search/search.ts`; the page state comes back and the page follows. Press Search instead: the same `search()`, through `app/api/search/route.ts`, with no model.

## Documents

| File                                                     | What it is                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/WRITE_UP.pdf](docs/WRITE_UP.pdf)                   | The write-up (two pages): approach, decisions, what I cut, risks, what comes next.                  |
| [docs/DESIGN.md](docs/DESIGN.md)                         | The plan: premises, conceptual design and the design choices, each with its reason.                 |
| [docs/BUILD.md](docs/BUILD.md)                           | The build: every step, the issues and how they were settled, the errors and warnings, next steps.   |
| [docs/AGENT_GRAPH.md](docs/AGENT_GRAPH.md)               | The agent: what goes in and out, what it reads, each tool's schemas and an example.                 |
| [docs/SEARCH_FUNCTION.md](docs/SEARCH_FUNCTION.md)       | The search function: why, and each part's input, output and an example.                             |
| [docs/PROMPT.md](docs/PROMPT.md)                         | The system prompt: where it is, what it says, and how each line came to be.                         |
| [docs/EVALS.md](docs/EVALS.md)                           | The eval cases (offline and live), the evals that judge them, and the results of the variants.      |
| [docs/METRICS.md](docs/METRICS.md)                       | The brief's success metrics: what in the app makes each one countable, and how to measure it.       |
| `docs/UI_LAYOUT.svg`, `SEARCH_FUNCTION.svg`, `AGENT_GRAPH.svg` | Figures, with the plan on the left and the build on the right.                                |

## Notes

- **How it was built.** I wrote the design and chose the test cases; a coding agent wrote the code and the tests to that spec; I reviewed each step, tested it by hand and ran the live eval. See [docs/BUILD.md](docs/BUILD.md).
- **Cost.** A chat turn costs two to five hundredths of a cent on `claude-haiku-5-5`; a live eval run about $0.08.
- **Today** is fixed at 2026-10-16, the date the data was exported, so the brief's examples behave the same on any day.
- **What it doesn't do:** a real hand-over (Yes ends the chat), website pages, promotions and flight prices. See "What I cut" in the write-up.
- **Pinned versions.** Dependencies are pinned exactly; the key and `.env.local` stay out of git.
