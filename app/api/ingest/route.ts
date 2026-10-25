import { NextResponse } from "next/server";
import { clearIngested, ingest, ingestedLocationParam, listIngested, type IngestPayload } from "@/lib/ingest-store";

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?ubereats\.com$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ok = ALLOWED_ORIGINS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Chrome Private Network Access: a public https page calling 127.0.0.1 preflights with this.
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function GET(req: Request) {
  const restaurants = listIngested();
  return NextResponse.json(
    {
      restaurants: restaurants.map((r) => ({ ...r, items: r.items.length })),
      items: restaurants.reduce((n, r) => n + r.items.length, 0),
      pl: ingestedLocationParam(),
    },
    { headers: cors(req) }
  );
}

export async function POST(req: Request) {
  let payload: IngestPayload;
  try {
    payload = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: cors(req) });
  }
  if (!Array.isArray(payload.restaurants)) {
    return NextResponse.json({ error: "restaurants[] is required." }, { status: 400, headers: cors(req) });
  }
  const result = ingest(payload);
  return NextResponse.json({ ok: true, ...result, total: listIngested().length }, { headers: cors(req) });
}

export async function DELETE(req: Request) {
  clearIngested();
  return NextResponse.json({ ok: true }, { headers: cors(req) });
}
