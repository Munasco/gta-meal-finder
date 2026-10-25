import { NextResponse } from "next/server";
import { analyzeIntent, decisionConfigFromEnv, type MealIntent } from "@/lib/intent";
import { setLocationParam } from "@/lib/ingest-store";
import type { BiomarkerLensId } from "@/lib/models";
import { credentialsFromEnv, encodeUberLocation, searchMenus, type MenuSearchResult } from "@/lib/uber-eats";
import { localDatasetEnabled, localDatasetStats } from "@/lib/dataset-local";

export interface FindRequest {
  query: string;
  address?: string;
  /** Delivery point picked on the map. Uber's location param is derived from it. */
  location?: { address: string; lat: number; lng: number };
  /** Only restaurants within this distance of the location (when their coordinates are known). */
  rangeKm?: number;
  /** Force a biomarker lens instead of the one Decision-1 infers. */
  lens?: BiomarkerLensId;
  /** Explicit budget; overrides any amount parsed from the text. */
  budgetCad?: number;
  /** Only restaurants / items with a BOGO or other deal. */
  dealsOnly?: boolean;
  /** Optional per-item calorie cap. */
  maxCalories?: number;
  /** Optional target health score; results closest to it rank first (Gaussian). */
  targetScore?: number;
}

export interface FindResponse {
  intent: MealIntent;
  search: MenuSearchResult;
  address: string;
}

const DEFAULT_ADDRESS = "200 Bay St, Toronto, ON M5J 2J2";

async function bridgeHealth(url?: string): Promise<{ running: boolean; browser?: boolean; busy?: boolean; lastError?: string | null; dataset?: { restaurants: number; items: number; withHealth: number } | null }> {
  if (!url) return { running: false };
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
    if (!r.ok) return { running: false };
    const j = (await r.json()) as { browser?: boolean; busy?: boolean; lastError?: string | null };
    const stats = await fetch(`${url}/dataset/stats`, { signal: AbortSignal.timeout(5000) }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    return { running: true, browser: j.browser, busy: j.busy, lastError: j.lastError, dataset: stats as { restaurants: number; items: number; withHealth: number } | null };
  } catch {
    return { running: false };
  }
}

export async function GET() {
  const env = credentialsFromEnv();
  const decision = decisionConfigFromEnv();
  return NextResponse.json({
    providers: {
      microsoftDecision1: Boolean(decision.apiKey),
      snapshot: localDatasetEnabled() ? await localDatasetStats().catch(() => null) : null,
      browserBridge: localDatasetEnabled() ? { running: false } : await bridgeHealth(env.bridgeUrl),
      /** Browser-restricted Google Maps key; null falls back to OpenStreetMap. */
      googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || null,
    },
  });
}

export async function POST(req: Request) {
  let body: FindRequest;
  try {
    body = (await req.json()) as FindRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "Tell me what you want to eat." }, { status: 400 });

  const loc = body.location && Number.isFinite(body.location.lat) && Number.isFinite(body.location.lng) ? body.location : null;
  const address = loc?.address?.trim() || body.address?.trim() || DEFAULT_ADDRESS;
  if (loc) setLocationParam(encodeUberLocation({ address, lat: loc.lat, lng: loc.lng }));

  const decision = decisionConfigFromEnv();
  const creds = credentialsFromEnv();

  const intent = await analyzeIntent(query, decision);
  if (body.lens) intent.primaryLens = body.lens;
  if (typeof body.budgetCad === "number" && Number.isFinite(body.budgetCad) && body.budgetCad > 0) {
    intent.budgetCad = body.budgetCad;
  }
  if (typeof body.maxCalories === "number" && body.maxCalories > 0) intent.maxCalories = body.maxCalories;
  const rangeKm = typeof body.rangeKm === "number" && body.rangeKm > 0 ? body.rangeKm : undefined;
  const search = await searchMenus(intent, address, creds, {
    dealsOnly: Boolean(body.dealsOnly),
    origin: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
    rangeKm,
    targetScore: typeof body.targetScore === "number" && body.targetScore > 0 && body.targetScore <= 100 ? body.targetScore : undefined,
  });
  const response: FindResponse = { intent, search, address };
  return NextResponse.json(response);
}
