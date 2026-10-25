import { NextResponse } from "next/server";
import { analyzeIntent } from "@/lib/intent";
import { credentialsFromEnv, searchMenus } from "@/lib/uber-eats";

/**
 * Searches Uber Eats menus for a free-text request.
 * Provider order: official Uber Eats MCP (OAuth token) → Apify Uber Eats scraper → verified GTA catalogue.
 */
export async function POST(req: Request) {
  let body: { query?: string; searchQuery?: string; address?: string; deliveryAddress?: string; apifyToken?: string; uberEatsMcpToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = (body.query ?? body.searchQuery ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const creds = credentialsFromEnv();
  if (body.apifyToken?.trim()) creds.apifyToken = body.apifyToken.trim();
  if (body.uberEatsMcpToken?.trim()) creds.uberEatsMcpToken = body.uberEatsMcpToken.trim();

  const intent = await analyzeIntent(query);
  const result = await searchMenus(intent, body.address?.trim() || body.deliveryAddress?.trim() || "200 Bay St, Toronto, ON M5J 2J2", creds);
  return NextResponse.json({ intent, ...result });
}
