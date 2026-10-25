import { NextResponse } from "next/server";
import { analyzeIntent } from "@/lib/intent";
import { searchMenus } from "@/lib/uber-eats";

/**
 * Searches Uber Eats menus for a free-text request.
 * Provider order: dataset → verified GTA catalogue.
 */
export async function POST(req: Request) {
  let body: { query?: string; searchQuery?: string; address?: string; deliveryAddress?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = (body.query ?? body.searchQuery ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const intent = await analyzeIntent(query);
  const result = await searchMenus(intent, body.address?.trim() || body.deliveryAddress?.trim() || "200 Bay St, Toronto, ON M5J 2J2");
  return NextResponse.json({ intent, ...result });
}
