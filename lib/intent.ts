import type { AllergenTag, BiomarkerLensId, DecisionApiNoulWeights } from "./models";

export type ProteinPreference = "chicken" | "fish" | "plant" | "beef" | "any";
export type DietConstraint = "none" | "vegetarian" | "vegan" | "pescatarian" | "gluten_free" | "dairy_free" | "halal" | "keto_low_carb";

export type TasteProfile =
  | "warm_savory_grain_bowl"
  | "spicy_asian_lemongrass_satay"
  | "smoky_mexican_chipotle_lime"
  | "mediterranean_herb_olive_lemon"
  | "crisp_superfood_greens_salad"
  | "high_protein_grilled_plate";

export interface MealIntent {
  queryText: string;
  /** Which engine produced the classification. */
  engine: "microsoft-decision-1" | "heuristic";
  latencyMs: number;
  primaryLens: BiomarkerLensId;
  primaryConfidence: number;
  lensProbabilities: Record<string, number>;
  tasteProfile: TasteProfile;
  tasteConfidence: number;
  protein: ProteinPreference;
  proteinConfidence: number;
  ironDirection: "reduce_iron_overload" | "boost_iron_deficiency" | "neutral_iron";
  /** 0-1: how strongly the user wants big / filling portions. */
  wantsLargePortions: number;
  /** 0-1: avoid fried / battered items. */
  limitFried: number;
  /** Hard dietary rule the results must respect. */
  diet: DietConstraint;
  /** 0-1: wants spicy food. */
  wantsSpicy: number;
  noulWeights: DecisionApiNoulWeights;
  budgetCad: number | null;
  /** Optional per-item calorie cap (applies where calories are known or estimated). */
  maxCalories: number | null;
  servings: number;
  restaurantHint: string | null;
  cuisineHint: string | null;
  detectedAllergens: AllergenTag[];
  detectedIngredientExclusions: string[];
  /** Short search phrase for Uber Eats, e.g. "nandos grilled chicken". */
  searchTerm: string;
}

export const ALLERGEN_KEYWORDS: Record<AllergenTag, string[]> = {
  peanuts: ["peanut", "peanuts", "groundnut"],
  tree_nuts: ["tree nut", "tree nuts", "almond", "almonds", "walnut", "cashew", "pecan", "pistachio", "hazelnut"],
  sesame: ["sesame", "tahini"],
  gluten: ["gluten", "celiac", "wheat", "barley", "rye"],
  dairy: ["dairy", "milk", "lactose", "cheese", "cheddar", "feta", "yogurt", "whey"],
  soy: ["soy", "soya", "tempeh", "edamame", "tamari"],
  egg: ["egg", "eggs", "mayo"],
  shellfish: ["shellfish", "shrimp", "prawn", "crab", "lobster"],
  fish: ["fish", "tuna", "cod"],
};

const KNOWN_RESTAURANTS = [
  "nando's",
  "nandos",
  "freshii",
  "impact kitchen",
  "kupfert",
  "mandy's",
  "mandys",
  "poulet rouge",
  "chipotle",
  "basil box",
  "chick-fil-a",
  "chick fil a",
  "popeyes",
  "kfc",
  "swiss chalet",
  "cactus club",
  "earls",
  "osmow's",
  "osmows",
  "shawarma",
  "paramount",
  "lazeez",
  "the chopped leaf",
  "chopped leaf",
  "subway",
  "pita pit",
  "mucho burrito",
  "burrito boyz",
  "fit for life",
  "fresh restaurants",
  "planta",
  "halal guys",
  "aroma",
  "panera",
  "wendy's",
  "sweetgreen",
];

const CUISINES = [
  "portuguese",
  "peri peri",
  "peri-peri",
  "mediterranean",
  "greek",
  "middle eastern",
  "lebanese",
  "persian",
  "indian",
  "thai",
  "vietnamese",
  "japanese",
  "korean",
  "chinese",
  "mexican",
  "italian",
  "caribbean",
  "jamaican",
  "halal",
  "shawarma",
  "sushi",
  "poke",
  "salad",
  "bowl",
];

const DEFAULT_WEIGHTS: DecisionApiNoulWeights = {
  boost_soluble_fibre: 0.7,
  boost_cruciferous_ugt1a1: 0.5,
  boost_steady_complex_carbs: 0.6,
  boost_bioavailable_iron_vitc: 0.3,
  boost_non_heme_plant_protein: 0.4,
  boost_potassium_produce: 0.6,
  limit_saturated_fat: 0.75,
  limit_refined_sugars: 0.75,
  limit_heme_red_meat: 0.35,
  limit_high_sodium: 0.65,
};

export function detectAllergensAndExclusions(text: string): {
  allergens: AllergenTag[];
  customExclusions: string[];
} {
  const lower = text.toLowerCase();
  const allergens: AllergenTag[] = [];
  for (const [tag, words] of Object.entries(ALLERGEN_KEYWORDS) as [AllergenTag, string[]][]) {
    if (words.some((w) => new RegExp(`(?:no|avoid|allergic to|without|exclude)\\s+${w}\\b`, "i").test(lower))) {
      allergens.push(tag);
    }
  }
  const customExclusions: string[] = [];
  const regex = /(?:allergic to|allergy to|no|avoid|exclude|without|can't eat|cannot eat|intolerant to)\s+([a-z\s,]+?)(?:[.;]|$|\band\b|\bbut\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lower)) !== null) {
    const phrase = match[1]?.trim();
    if (!phrase) continue;
    for (const part of phrase.split(",")) {
      const cleaned = part.trim();
      if (cleaned.length >= 3 && cleaned.length <= 24 && !customExclusions.includes(cleaned)) {
        customExclusions.push(cleaned);
      }
    }
  }
  return { allergens, customExclusions };
}

export function parseBudgetCad(text: string): number | null {
  const lower = text.toLowerCase();
  const patterns = [
    /\$\s?(\d{1,4}(?:\.\d{1,2})?)/,
    /(\d{1,4}(?:\.\d{1,2})?)\s?(?:dollars|bucks|cad|\$)/,
    /(?:under|below|max|budget(?: of| is)?|for|around|about|less than)\s+\$?(\d{1,4}(?:\.\d{1,2})?)\b/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 5 && n <= 2000) return n;
    }
  }
  return null;
}

export function parseServings(text: string): number {
  const lower = text.toLowerCase();
  const explicit = lower.match(/for\s+(\d{1,2})\s*(?:people|persons|ppl|of us|guests|adults)/);
  if (explicit) return Math.max(1, Number(explicit[1]));
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const worded = lower.match(/for\s+(two|three|four|five|six)\s*(?:people|of us|ppl)?/);
  if (worded) return words[worded[1]] ?? 1;
  if (/\b(family|group|party|share|sharing)\b/.test(lower)) return 4;
  if (/\b(me and|two of us|both of us|couple|date)\b/.test(lower)) return 2;
  return 1;
}

export function parseRestaurantHint(text: string): string | null {
  const lower = text.toLowerCase();
  for (const name of KNOWN_RESTAURANTS) {
    if (lower.includes(name)) return name === "nandos" ? "nando's" : name;
  }
  const like = lower.match(/(?:like|from|at)\s+([a-z'][a-z' ]{2,24}?)(?:\s+or\b|\s+please|[.,!?]|$)/);
  if (like) {
    const candidate = like[1].trim();
    if (!/^(a |an |the |some |something|healthy|chicken|food)/.test(candidate)) return candidate;
  }
  return null;
}

export function parseCuisineHint(text: string): string | null {
  const lower = text.toLowerCase();
  return CUISINES.find((c) => lower.includes(c)) ?? null;
}

function heuristicProtein(lower: string): ProteinPreference {
  if (/\b(chicken|poultry|turkey|peri|nando)/.test(lower)) return "chicken";
  if (/\b(salmon|fish|tuna|cod|seafood|shrimp|poke)/.test(lower)) return "fish";
  if (/\b(tofu|vegan|vegetarian|plant|lentil|chickpea|bean)/.test(lower)) return "plant";
  if (/\b(beef|steak|lamb|burger)/.test(lower)) return "beef";
  return "any";
}

function heuristicLens(lower: string): BiomarkerLensId {
  if (/bilirubin|gilbert|jaundice/.test(lower)) return "bilirubin_elevated";
  if (/hemochromatosis|iron overload|high iron|ferritin high|too much iron/.test(lower)) return "iron_high";
  if (/anemi|low iron|iron deficien|more iron/.test(lower)) return "iron_low";
  if (/fatty liver|masld|nafld|nash|\balt\b|\bast\b/.test(lower)) return "fatty_liver_masld";
  if (/blood pressure|hypertension|low sodium|low salt|dash diet/.test(lower)) return "sodium_bp";
  if (/diabet|glucose|a1c|insulin|blood sugar|prediabet/.test(lower)) return "glycemic_steady";
  return "general_healthy";
}

function heuristicTaste(lower: string): TasteProfile {
  if (/thai|lemongrass|satay|spicy asian|ginger|wok/.test(lower)) return "spicy_asian_lemongrass_satay";
  if (/mexican|burrito|chipotle|taco|salsa|lime/.test(lower)) return "smoky_mexican_chipotle_lime";
  if (/mediterranean|greek|olive|lemon|peri|portuguese|shawarma|herb/.test(lower)) return "mediterranean_herb_olive_lemon";
  if (/salad|greens|kale|light|fresh/.test(lower)) return "crisp_superfood_greens_salad";
  if (/protein|grilled|plate|platter|steak|salmon|chicken/.test(lower)) return "high_protein_grilled_plate";
  return "warm_savory_grain_bowl";
}

function buildSearchTerm(input: {
  restaurantHint: string | null;
  cuisineHint: string | null;
  protein: ProteinPreference;
  queryText: string;
}): string {
  if (input.restaurantHint) return input.restaurantHint;
  const parts: string[] = [];
  if (input.cuisineHint) parts.push(input.cuisineHint);
  if (input.protein !== "any") parts.push(input.protein === "plant" ? "vegetarian" : input.protein);
  if (parts.length === 0) {
    const kw = input.queryText
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["want", "with", "enough", "portions", "something", "please", "healthy", "like", "food", "meal", "dollars", "bucks", "under", "budget"].includes(w));
    parts.push(...kw.slice(0, 2));
  }
  return parts.join(" ").trim() || "healthy";
}

const DECISION_QUESTIONS = {
  primary_lens: {
    type: "choice",
    instructions: "Choose the primary nutritional biomarker lens that best matches the user's described condition or biomarker focus.",
    criteria: {
      bilirubin_elevated: "Elevated bilirubin, Gilbert's syndrome, hyperbilirubinemia, jaundice, or bilirubin liver support",
      iron_high: "High iron, elevated ferritin, hemochromatosis, iron overload, or wanting less dietary iron / red meat",
      iron_low: "Low iron, iron deficiency, anemia, low ferritin, or needing more iron",
      fatty_liver_masld: "Fatty liver, MASLD, NAFLD, NASH, elevated ALT/AST, or hepatic fat reduction",
      sodium_bp: "High blood pressure, hypertension, fluid retention, or strict low-sodium diet",
      glycemic_steady: "Prediabetes, type 2 diabetes, insulin resistance, high glucose/A1c, or blood sugar control",
      general_healthy: "General healthy eating, macro balance, or a taste / budget query with no clinical biomarker mentioned",
    },
  },
  taste_craving: {
    type: "choice",
    instructions: "Classify the user's culinary taste, flavour craving, or meal style preference.",
    criteria: {
      warm_savory_grain_bowl: "Warm, hearty brown rice, quinoa, or lentil grain bowl with savoury flavours",
      spicy_asian_lemongrass_satay: "Spicy Southeast Asian, Thai, lemongrass, ginger, satay, or wok vegetables",
      smoky_mexican_chipotle_lime: "Smoky Mexican, Southwest, black beans, avocado, salsa, cilantro, or lime",
      mediterranean_herb_olive_lemon: "Mediterranean, Portuguese peri-peri, garlicky herb chicken, lemon, olive oil, roasted vegetables, chickpeas",
      crisp_superfood_greens_salad: "Fresh, crisp gourmet salad, kale, or light refreshing greens",
      high_protein_grilled_plate: "High-protein plate with grilled chicken, salmon, or steak plus sides",
    },
  },
  protein: {
    type: "choice",
    instructions: "Which main protein does the user want?",
    criteria: {
      chicken: "Chicken, poultry, turkey, peri-peri, Nando's style",
      fish: "Fish, salmon, tuna, seafood, poke",
      plant: "Tofu, tempeh, beans, lentils, vegetarian or vegan",
      beef: "Beef, steak, lamb, burgers",
      any: "No protein preference stated",
    },
  },
  iron_direction: {
    type: "choice",
    instructions: "If iron is mentioned, decide whether the user needs to reduce iron (overload), boost iron (deficiency), or neutral.",
    criteria: {
      reduce_iron_overload: "High iron, hemochromatosis, elevated ferritin, or wants less iron / red meat",
      boost_iron_deficiency: "Low iron, anemia, iron deficiency, or wants more bioavailable iron",
      neutral_iron: "Iron not mentioned or ambiguous",
    },
  },
  wants_large_portions: {
    type: "noul",
    instructions: "Does the user want large, filling, or generous portions (e.g. 'enough portions', 'filling', 'big', 'for sharing')?",
  },
  diet_constraint: {
    type: "choice",
    instructions: "Does the user state a hard dietary rule the food must follow? Only pick one if it is explicit.",
    criteria: {
      none: "No dietary rule stated",
      vegetarian: "Vegetarian (no meat or fish; eggs and dairy fine)",
      vegan: "Vegan or plant-based only (no meat, fish, eggs, dairy, honey)",
      pescatarian: "Pescatarian (fish and seafood fine, no other meat)",
      gluten_free: "Gluten-free or celiac",
      dairy_free: "Dairy-free or lactose intolerant",
      halal: "Halal only",
      keto_low_carb: "Keto or low-carb",
    },
  },
  wants_spicy: {
    type: "noul",
    instructions: "Does the user want spicy or hot food? (0 if they want mild or do not mention it)",
  },
  limit_fried: {
    type: "noul",
    instructions: "Should deep-fried, battered, or crispy-fried items be avoided for this user (healthy request or liver / lipid / weight concerns)?",
  },
  boost_soluble_fibre: { type: "noul", instructions: "Should this user TAKE MORE soluble & total dietary fibre (beans, lentils, whole grains, avocado)?" },
  boost_cruciferous_ugt1a1: { type: "noul", instructions: "Should this user TAKE MORE cruciferous vegetables (broccoli, kale, cabbage) to support UGT1A1 bilirubin conjugation?" },
  boost_steady_complex_carbs: { type: "noul", instructions: "Should this user TAKE MORE steady complex carbohydrates and avoid very low-calorie meals?" },
  boost_bioavailable_iron_vitc: { type: "noul", instructions: "Should this user TAKE MORE bioavailable iron paired with Vitamin C?" },
  boost_non_heme_plant_protein: { type: "noul", instructions: "Should this user TAKE MORE plant proteins and polyphenol-rich greens instead of red meat?" },
  boost_potassium_produce: { type: "noul", instructions: "Should this user TAKE MORE potassium-rich vegetables and legumes?" },
  limit_saturated_fat: { type: "noul", instructions: "Should this user TAKE LESS saturated fat and fried oils?" },
  limit_refined_sugars: { type: "noul", instructions: "Should this user TAKE LESS refined sugars and sweet glazes?" },
  limit_heme_red_meat: { type: "noul", instructions: "Should this user TAKE LESS heme iron / red meat?" },
  limit_high_sodium: { type: "noul", instructions: "Should this user TAKE LESS sodium?" },
} as const;

type DecisionAnswer = {
  type: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  noul?: number;
};

export interface DecisionConfig {
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
}

export function decisionConfigFromEnv(): DecisionConfig {
  return {
    endpoint:
      process.env.AZURE_DECISION_ENDPOINT ??
      "https://terox-wcus-foundry.services.ai.azure.com/providers/microsoft/v1/systemone",
    apiKey: process.env.AZURE_DECISION_KEY,
    deployment: process.env.AZURE_DECISION_DEPLOYMENT ?? "decision-1",
  };
}

async function callDecisionOne(queryText: string, config: DecisionConfig) {
  if (!config.apiKey || !config.endpoint) return null;
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": config.apiKey },
    body: JSON.stringify({
      model: config.deployment ?? "decision-1",
      state: JSON.stringify({
        user_request: queryText,
        context:
          "Greater Toronto Area food-delivery assistant. The user describes what they want to eat, a budget, portion needs, and optionally biomarkers (bilirubin, iron, liver, blood pressure, glucose).",
      }),
      questions: DECISION_QUESTIONS,
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft Decision-1 HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as { model: string; answers: Record<string, DecisionAnswer> };
}

const round = (n: number) => Number(n.toFixed(4));

export async function analyzeIntent(
  queryText: string,
  config: DecisionConfig = decisionConfigFromEnv()
): Promise<MealIntent> {
  const lower = queryText.toLowerCase();
  const { allergens, customExclusions } = detectAllergensAndExclusions(queryText);
  const budgetCad = parseBudgetCad(queryText);
  const servings = parseServings(queryText);
  const restaurantHint = parseRestaurantHint(queryText);
  const cuisineHint = parseCuisineHint(queryText);

  const t0 = Date.now();
  let raw: Awaited<ReturnType<typeof callDecisionOne>> = null;
  let engine: MealIntent["engine"] = "heuristic";
  try {
    raw = await callDecisionOne(queryText, config);
    if (raw) engine = "microsoft-decision-1";
  } catch (error) {
    console.warn("[intent] Decision-1 unavailable, using heuristics:", error instanceof Error ? error.message : error);
  }
  const latencyMs = Date.now() - t0;
  const a = raw?.answers ?? {};

  const primaryLens = (a.primary_lens?.choice as BiomarkerLensId | undefined) ?? heuristicLens(lower);
  const tasteProfile = (a.taste_craving?.choice as TasteProfile | undefined) ?? heuristicTaste(lower);
  const protein = (a.protein?.choice as ProteinPreference | undefined) ?? heuristicProtein(lower);
  const ironDirection = (a.iron_direction?.choice as MealIntent["ironDirection"] | undefined) ?? "neutral_iron";

  const noulWeights: DecisionApiNoulWeights = { ...DEFAULT_WEIGHTS };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof DecisionApiNoulWeights)[]) {
    const v = a[key]?.noul;
    if (typeof v === "number") noulWeights[key] = round(v);
  }

  const lensProbabilities: Record<string, number> = {};
  for (const [k, v] of Object.entries(a.primary_lens?.probabilities ?? {})) lensProbabilities[k] = round(v);

  const portionWords = /\b(enough|filling|big|large|generous|hearty|share|sharing|family|feast|hungry|portions?)\b/.test(lower);
  const heuristicDiet = (): DietConstraint =>
    /\bvegan|plant[- ]based\b/.test(lower) ? "vegan"
    : /\bvegetarian|veggie only|no meat\b/.test(lower) ? "vegetarian"
    : /\bpescatarian\b/.test(lower) ? "pescatarian"
    : /gluten[- ]?free|celiac|coeliac/.test(lower) ? "gluten_free"
    : /dairy[- ]?free|lactose/.test(lower) ? "dairy_free"
    : /\bhalal\b/.test(lower) ? "halal"
    : /\bketo|low[- ]carb\b/.test(lower) ? "keto_low_carb"
    : "none";
  const dietFromModel = a.diet_constraint?.choice as DietConstraint | undefined;
  const diet: DietConstraint = dietFromModel && dietFromModel !== "none" && (a.diet_constraint?.confidence ?? 0) >= 0.6 ? dietFromModel : heuristicDiet();

  return {
    queryText,
    engine,
    latencyMs,
    primaryLens,
    primaryConfidence: round(a.primary_lens?.confidence ?? 0.6),
    lensProbabilities,
    tasteProfile,
    tasteConfidence: round(a.taste_craving?.confidence ?? 0.5),
    protein,
    proteinConfidence: round(a.protein?.confidence ?? 0.6),
    ironDirection,
    wantsLargePortions: round(a.wants_large_portions?.noul ?? (portionWords ? 0.8 : 0.3)),
    limitFried: round(a.limit_fried?.noul ?? (/healthy|light|lean|liver|fat/.test(lower) ? 0.85 : 0.4)),
    diet,
    wantsSpicy: round(a.wants_spicy?.noul ?? (/\bspicy|hot\b|peri|chili/.test(lower) ? 0.8 : 0.2)),
    noulWeights,
    budgetCad,
    maxCalories: null,
    servings,
    restaurantHint,
    cuisineHint,
    detectedAllergens: allergens,
    detectedIngredientExclusions: customExclusions,
    searchTerm: buildSearchTerm({ restaurantHint, cuisineHint, protein, queryText }),
  };
}
