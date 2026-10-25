import { GTA_DISH_CATALOGUE } from "./gta-catalogue";
import type { AllergenTag, BiomarkerLensId, DishCategory } from "./models";
import { evaluateDish } from "./scoring-engine";
import { BIOMARKER_LENSES, SCIENTIFIC_STUDIES } from "./studies-and-lenses";

export type MealFilters = {
  query?: string;
  category?: DishCategory;
  location?: string;
  biomarkerLens?: BiomarkerLensId;
  excludedIngredients?: string[];
  excludedAllergens?: AllergenTag[];
  maxSodiumMg?: number;
  minProteinG?: number;
  minFibreG?: number;
  maxSaturatedFatG?: number;
  maxSugarsG?: number;
  maxCalories?: number;
};

export interface MealCatalogueService {
  search(filters: MealFilters): unknown | Promise<unknown>;
  get(id: string, biomarkerLens?: BiomarkerLensId): unknown | Promise<unknown>;
  compare(ids: string[], filters: MealFilters): unknown | Promise<unknown>;
  getBiomarkerGuidelines(lens?: BiomarkerLensId): unknown | Promise<unknown>;
}

const filterProperties = {
  query: { type: "string", description: "Meal, ingredient, or GTA restaurant name." },
  category: {
    type: "string",
    enum: ["bowls", "salads", "plates", "wraps", "soups", "smoothies"],
    description: "Dish category from the GTA catalogue.",
  },
  location: {
    type: "string",
    description: "GTA neighborhood or area filter (e.g., Downtown, Yorkville, King West, Mississauga, Scarborough).",
  },
  biomarkerLens: {
    type: "string",
    enum: [
      "general_healthy",
      "bilirubin_elevated",
      "iron_high",
      "iron_low",
      "fatty_liver_masld",
      "sodium_bp",
      "glycemic_steady",
    ],
    description:
      "Optional biomarker lens returning bidirectional 'Take MORE Of' (boosts) and 'Take LESS Of' (limits) evaluation.",
  },
  excludedIngredients: {
    type: "array",
    items: { type: "string" },
    description: "Explicit ingredient exclusions.",
  },
  excludedAllergens: {
    type: "array",
    items: {
      type: "string",
      enum: ["peanuts", "tree_nuts", "sesame", "gluten", "dairy", "soy", "egg", "shellfish", "fish"],
    },
    description: "Explicit allergen exclusions.",
  },
  maxSodiumMg: { type: "number", minimum: 0 },
  minProteinG: { type: "number", minimum: 0 },
  minFibreG: { type: "number", minimum: 0 },
  maxSaturatedFatG: { type: "number", minimum: 0 },
  maxSugarsG: { type: "number", minimum: 0 },
  maxCalories: { type: "number", minimum: 0 },
};

const filterSchema = {
  type: "object",
  properties: filterProperties,
  additionalProperties: false,
};

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const mealTools = [
  {
    name: "search_meals",
    description:
      "Search the GTA healthy dish catalogue with Baseline Health Scores (0-100, Nutri-Score + Harvard AHEI-2010 + Health Canada FOP) and bidirectional Biomarker Fit Scores ('Take MORE Of' boosts & 'Take LESS Of' limits).",
    inputSchema: filterSchema,
    annotations,
  },
  {
    name: "get_meal_details",
    description:
      "Retrieve complete nutrition breakdown, Baseline Health Score components, bidirectional biomarker fit analysis, GTA locations, DoorDash checkout links, and scientific study citations for one dish.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1 },
        biomarkerLens: filterProperties.biomarkerLens,
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations,
  },
  {
    name: "compare_meals",
    description:
      "Compare two or three GTA dishes side-by-side across Baseline Health Score, Biomarker Fit Score, 'Take MORE Of' hits, 'Take LESS Of' checks, macros, and sodium.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string", minLength: 1 },
          minItems: 2,
          maxItems: 3,
          uniqueItems: true,
        },
        filters: filterSchema,
      },
      required: ["ids"],
      additionalProperties: false,
    },
    annotations,
  },
  {
    name: "get_biomarker_guidelines",
    description:
      "Return bidirectional 'What to Take MORE Of (Boosts)' and 'What to Take LESS Of (Limits)' nutritional guidelines and peer-reviewed study citations for a biomarker lens (e.g. bilirubin_elevated, iron_high, iron_low).",
    inputSchema: {
      type: "object",
      properties: {
        biomarkerLens: filterProperties.biomarkerLens,
      },
      additionalProperties: false,
    },
    annotations,
  },
  {
    name: "find_menu_options",
    description:
      "Searches GTA restaurant dishes (Uber Eats menus and the verified catalogue) with Baseline Health Scores (0-100) and Biomarker Fit Scores.",
    inputSchema: {
      type: "object",
      properties: {
        search_term: {
          type: "string",
          description: "Dish, restaurant, or biomarker keyword to search on Uber Eats / DoorDash Toronto.",
        },
        biomarkerLens: filterProperties.biomarkerLens,
      },
      additionalProperties: false,
    },
    annotations,
  },
];

export const defaultGtaMealCatalogueService: MealCatalogueService = {
  search(filters: MealFilters) {
    const lens: BiomarkerLensId = filters.biomarkerLens ?? "bilirubin_elevated";
    const q = filters.query?.trim().toLowerCase();
    const locQuery = filters.location?.trim().toLowerCase();

    const evaluated = GTA_DISH_CATALOGUE.filter((dish) => {
      if (filters.category && dish.category !== filters.category) return false;
      if (q) {
        const hay = `${dish.name} ${dish.restaurant} ${dish.description} ${dish.ingredients.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (locQuery) {
        const locMatch = dish.locations.some(
          (l) =>
            l.neighborhood.toLowerCase().includes(locQuery) ||
            l.address.toLowerCase().includes(locQuery) ||
            l.city.toLowerCase().includes(locQuery)
        );
        if (!locMatch) return false;
      }
      if (filters.maxCalories !== undefined && dish.nutrients.calories > filters.maxCalories) {
        return false;
      }
      return true;
    })
      .map((dish) =>
        evaluateDish(dish, {
          activeLens: lens,
          excludedAllergens: filters.excludedAllergens ?? [],
          excludedIngredients: filters.excludedIngredients ?? [],
          minFibreG: filters.minFibreG,
          minProteinG: filters.minProteinG,
          maxSodiumMg: filters.maxSodiumMg,
          maxSaturatedFatG: filters.maxSaturatedFatG,
          maxSugarsG: filters.maxSugarsG,
        })
      )
      .sort((a, b) => b.combinedRankScore - a.combinedRankScore);

    return {
      activeBiomarkerLens: BIOMARKER_LENSES[lens],
      totalMatches: evaluated.filter((e) => e.matchState.type === "matches").length,
      totalEvaluated: evaluated.length,
      results: evaluated.map((item) => ({
        id: item.dish.id,
        name: item.dish.name,
        restaurant: item.dish.restaurant,
        category: item.dish.category,
        priceCad: item.dish.priceCad,
        baselineHealthScore: item.baselineScore,
        baselineGrade: item.baselineGrade,
        biomarkerFitScore: item.biomarkerFitScore,
        combinedRankScore: item.combinedRankScore,
        matchState: item.matchState,
        nutrients: item.dish.nutrients,
        takeMoreOfHits: item.takeMoreOfHits,
        takeLessOfChecks: item.takeLessOfChecks,
        locations: item.dish.locations,
        nutritionSourceUrl: item.dish.nutritionSourceUrl,
      })),
    };
  },

  get(id: string, biomarkerLens?: BiomarkerLensId) {
    const dish = GTA_DISH_CATALOGUE.find((d) => d.id === id);
    if (!dish) return null;
    const lens = biomarkerLens ?? "bilirubin_elevated";
    return evaluateDish(dish, {
      activeLens: lens,
      excludedAllergens: [],
      excludedIngredients: [],
    });
  },

  compare(ids: string[], filters: MealFilters) {
    const lens = filters.biomarkerLens ?? "bilirubin_elevated";
    const items = ids
      .map((id) => GTA_DISH_CATALOGUE.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((dish) =>
        evaluateDish(dish, {
          activeLens: lens,
          excludedAllergens: filters.excludedAllergens ?? [],
          excludedIngredients: filters.excludedIngredients ?? [],
          minFibreG: filters.minFibreG,
          minProteinG: filters.minProteinG,
          maxSodiumMg: filters.maxSodiumMg,
          maxSaturatedFatG: filters.maxSaturatedFatG,
          maxSugarsG: filters.maxSugarsG,
        })
      );

    return {
      biomarkerLens: BIOMARKER_LENSES[lens],
      comparedDishes: items,
      winnerByCombinedScore:
        [...items].sort((a, b) => b.combinedRankScore - a.combinedRankScore)[0]?.dish.name ?? null,
      winnerByBaselineHealth:
        [...items].sort((a, b) => b.baselineScore - a.baselineScore)[0]?.dish.name ?? null,
    };
  },

  getBiomarkerGuidelines(lens?: BiomarkerLensId) {
    if (lens && BIOMARKER_LENSES[lens]) {
      return {
        lens: BIOMARKER_LENSES[lens],
        studies: SCIENTIFIC_STUDIES,
      };
    }
    return {
      lenses: BIOMARKER_LENSES,
      studies: SCIENTIFIC_STUDIES,
    };
  },
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Arguments must be an object.");
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Unsupported argument. Supply explicit food preferences, biomarkerLens, or nutrient targets.");
  }
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFilters(value: unknown): MealFilters {
  const input = object(value);
  keys(input, Object.keys(filterProperties));
  for (const [key, val] of Object.entries(input)) {
    if (key === "query" || key === "category" || key === "location" || key === "biomarkerLens") {
      if (!nonempty(val)) throw new Error(`${key} must be a nonempty string.`);
      if (key === "category" && !filterProperties.category.enum.includes(val)) {
        throw new Error("Choose bowls, salads, plates, wraps, soups, or smoothies.");
      }
      if (key === "biomarkerLens" && !filterProperties.biomarkerLens.enum.includes(val)) {
        throw new Error(`Invalid biomarkerLens: ${val}`);
      }
    } else if (key === "excludedIngredients" || key === "excludedAllergens") {
      if (!Array.isArray(val) || !val.every(nonempty)) {
        throw new Error(`${key} must contain nonempty strings.`);
      }
    } else if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
      throw new Error(`${key} must be a finite nonnegative number.`);
    }
  }
  return input as MealFilters;
}

export function createMealMcpHandler(service: MealCatalogueService = defaultGtaMealCatalogueService) {
  return async function POST(request: Request): Promise<Response> {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON." } },
        { status: 400 }
      );
    }
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null;
    const id = message?.id;
    const validId =
      typeof id === "string" || (typeof id === "number" && Number.isFinite(id)) || id === null;
    const rpcError = (code: number, msg: string, status = 200) =>
      Response.json({ jsonrpc: "2.0", id: validId ? id : null, error: { code, message: msg } }, { status });

    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string" || (id !== undefined && !validId)) {
      return rpcError(-32600, "Invalid JSON-RPC request.", 400);
    }
    if (id === undefined) return new Response(null, { status: 204 });

    const result = (value: unknown) => Response.json({ jsonrpc: "2.0", id, result: value });

    switch (message.method) {
      case "server/discover":
        return result({
          supportedVersions: ["2026-07-28", "2025-03-26"],
          capabilities: { tools: {} },
          serverInfo: { name: "gta-vitalplate-mcp", version: "1.0.0" },
        });
      case "initialize":
        return result({
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "gta-vitalplate-mcp", version: "1.0.0" },
          instructions:
            "GTA Healthy Dish & Biomarker Nutrition MCP Server. Supports Baseline Health Scores (0-100) and bidirectional Biomarker Lenses (bilirubin_elevated, iron_high, iron_low, fatty_liver_masld, sodium_bp, glycemic_steady).",
        });
      case "ping":
        return result({});
      case "tools/list":
        return result({ tools: mealTools });
      case "tools/call": {
        let params: Record<string, unknown>;
        try {
          params = object(message.params);
        } catch {
          return rpcError(-32602, "Tool call parameters are required.");
        }
        if (!mealTools.some((tool) => tool.name === params.name)) {
          return rpcError(-32602, "Unknown tool.");
        }
        try {
          const args = object(params.arguments ?? {});
          let data: unknown;
          if (params.name === "search_meals") {
            data = await service.search(parseFilters(args));
          } else if (params.name === "get_meal_details") {
            keys(args, ["id", "biomarkerLens"]);
            if (!nonempty(args.id)) throw new Error("A meal ID is required.");
            data = await service.get(
              args.id,
              typeof args.biomarkerLens === "string" ? (args.biomarkerLens as BiomarkerLensId) : undefined
            );
            if (data == null) throw new Error("Meal not found in the catalogue.");
          } else if (params.name === "compare_meals") {
            keys(args, ["ids", "filters"]);
            const ids = args.ids;
            if (
              !Array.isArray(ids) ||
              ids.length < 2 ||
              ids.length > 3 ||
              !ids.every(nonempty) ||
              new Set(ids).size !== ids.length
            ) {
              throw new Error("Choose two or three different meal IDs.");
            }
            data = await service.compare(ids, parseFilters(args.filters ?? {}));
          } else if (params.name === "find_menu_options") {
            keys(args, ["search_term", "biomarkerLens"]);
            const searchTerm = typeof args.search_term === "string" ? args.search_term : undefined;
            const lens =
              typeof args.biomarkerLens === "string"
                ? (args.biomarkerLens as BiomarkerLensId)
                : "bilirubin_elevated";
            data = await service.search({
              query: searchTerm,
              biomarkerLens: lens,
            });
          } else {
            keys(args, ["biomarkerLens"]);
            data = await service.getBiomarkerGuidelines(
              typeof args.biomarkerLens === "string" ? (args.biomarkerLens as BiomarkerLensId) : undefined
            );
          }
          return result({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        } catch (error) {
          return result({
            isError: true,
            content: [
              {
                type: "text",
                text: error instanceof Error ? error.message : "Unable to read meal information.",
              },
            ],
          });
        }
      }
      default:
        return rpcError(-32601, "Method not found.");
    }
  };
}
