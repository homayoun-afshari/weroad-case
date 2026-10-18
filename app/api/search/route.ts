import { pageStateFor } from "@/lib/page/view";
import { searchRequestSchema } from "@/lib/search/schema";

/** The search button's way to the search function: a search request in, the new page state out. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The search request wasn't valid JSON." }, { status: 400 });
  }

  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return Response.json({ error: `The search isn't valid. ${where}${issue.message}` }, { status: 400 });
  }

  try {
    return Response.json(pageStateFor(parsed.data));
  } catch (error) {
    console.error("search failed", error);
    return Response.json({ error: "The search failed. Please try again." }, { status: 500 });
  }
}
