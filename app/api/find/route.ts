import { NextResponse } from "next/server";
import { analyzeIntent, decisionConfigFromEnv, type MealIntent } from "@/lib/intent";
import type { BiomarkerLensId } from "@/lib/models";
import { searchMenus, type MenuSearchResult } from "@/lib/uber-eats";
import { localDatasetStats, warmLocalDataset } from "@/lib/dataset-local";

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

export async function GET() {
  const decision = decisionConfigFromEnv();
  return NextResponse.json({
    providers: {
      microsoftDecision1: Boolean(decision.apiKey),
      snapshot: await localDatasetStats().catch(() => null),
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

  const decision = decisionConfigFromEnv();

  // Read the snapshot while Decision-1 thinks, so a cold start pays for one of them, not both.
  warmLocalDataset();
  const intent = await analyzeIntent(query, decision);
  if (body.lens) intent.primaryLens = body.lens;
  if (typeof body.budgetCad === "number" && Number.isFinite(body.budgetCad) && body.budgetCad > 0) {
    intent.budgetCad = body.budgetCad;
  }
  if (typeof body.maxCalories === "number" && body.maxCalories > 0) intent.maxCalories = body.maxCalories;
  const rangeKm = typeof body.rangeKm === "number" && body.rangeKm > 0 ? body.rangeKm : undefined;
  const search = await searchMenus(intent, address, {
    dealsOnly: Boolean(body.dealsOnly),
    origin: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
    rangeKm,
    targetScore: typeof body.targetScore === "number" && body.targetScore > 0 && body.targetScore <= 100 ? body.targetScore : undefined,
  });
  const response: FindResponse = { intent, search, address };
  return NextResponse.json(response);
}
