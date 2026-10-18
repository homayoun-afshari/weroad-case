import { z } from "zod";
import { describeFailure } from "@/lib/agent/errors";
import { getModel } from "@/lib/agent/model";
import { runTurn } from "@/lib/agent/turn";
import type { ChatEntry } from "@/lib/chat/types";

const message = z.looseObject({ role: z.enum(["user", "assistant", "tool"]) });
const entry = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), text: z.string(), blocks: z.string() }),
  z.object({ kind: z.literal("assistant"), text: z.string() }),
  z.object({ kind: z.literal("tools"), messages: z.array(message) }),
  z.object({ kind: z.literal("page"), events: z.array(z.looseObject({})) }),
  z.object({ kind: z.literal("error"), text: z.string() }),
  z.object({ kind: z.literal("handover"), answer: z.enum(["asked", "yes", "no"]) }),
]);
const bodySchema = z.object({ entries: z.array(entry).max(200), onScreen: z.array(z.number().int()).max(100) });

const bad = (error: string) => Response.json({ error }, { status: 400 });

/** One turn of the chat: the chat history and the trips on screen in (the client holds them), the new entries and the page out. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("The chat request wasn't valid JSON.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return bad("The chat request isn't valid.");

  // The models refuse a conversation that doesn't end with a user message
  const entries = parsed.data.entries as unknown as ChatEntry[];
  if (entries[entries.length - 1]?.kind !== "user") return bad("The chat must end with a user message.");

  try {
    return Response.json(await runTurn({ model: getModel(), entries, onScreen: parsed.data.onScreen, abortSignal: request.signal }));
  } catch (error) {
    const failure = describeFailure(error, { aborted: request.signal.aborted });
    // A stop is not a failure: the user left, and nothing needs an answer or a log line
    if (!failure.log) return new Response(null, { status: failure.status });
    console.error("chat turn failed", error);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
