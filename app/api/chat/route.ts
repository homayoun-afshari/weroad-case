import { z } from "zod";
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
]);
const bodySchema = z.object({ entries: z.array(entry).max(200) });

const bad = (error: string) => Response.json({ error }, { status: 400 });

/** One turn of the chat: the chat history in (the client holds it), the new entries and the page out. */
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
    return Response.json(await runTurn({ model: getModel(), entries, abortSignal: request.signal }));
  } catch (error) {
    console.error("chat turn failed", error);
    return Response.json({ error: "The assistant couldn't answer. Please try again." }, { status: 500 });
  }
}
