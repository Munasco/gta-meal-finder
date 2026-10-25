import { NextResponse } from "next/server";
import { analyzeIntent } from "@/lib/intent";

/** Classifies a free-text meal request with Microsoft Decision-1 (falls back to heuristics). */
export async function POST(request: Request) {
  let body: { text?: string; query?: string };
  try {
    body = (await request.json()) as { text?: string; query?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const queryText = (body.text ?? body.query ?? "").trim();
  if (!queryText) {
    return NextResponse.json({ error: "Describe what you want to eat." }, { status: 400 });
  }
  return NextResponse.json(await analyzeIntent(queryText));
}
