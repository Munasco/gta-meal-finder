import { createMealMcpHandler, defaultGtaMealCatalogueService } from "@/lib/meal-mcp";
import { NextResponse } from "next/server";

const handler = createMealMcpHandler(defaultGtaMealCatalogueService);

export async function POST(req: Request) {
  return handler(req);
}

export async function GET() {
  return NextResponse.json({
    name: "gta-biomarker-meal-finder-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    description:
      "Read-only JSON-RPC 2.0 MCP server for Greater Toronto Area (GTA) restaurant dishes, baseline nutritional scoring (Nutri-Score/FSA + Harvard AHEI + Health Canada FOP), and bidirectional biomarker lenses (Elevated Bilirubin, Iron High/Low, MASLD, Sodium/BP, Glycemic).",
    tools: [
      "search_meals",
      "get_meal_details",
      "compare_meals",
      "get_biomarker_guidelines",
    ],
  });
}
