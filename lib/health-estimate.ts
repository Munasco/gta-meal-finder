/**
 * Nutrition estimate for a menu item that publishes no nutrition.
 *
 * Microsoft Decision-1 reads the menu text and picks up to three USDA FoodData Central components
 * (protein, base/starch, vegetable or side) with portion sizes. Per-100 g nutrients from USDA SR Legacy
 * are summed, Decision-1's sodium / sugar / fat flags add restaurant-style seasoning, and the result is
 * scored by the same engine as the verified catalogue (Nutri-Score + AHEI + Health Canada cutoffs).
 */
import usda from "../data/usda-components.json";
import type { DecisionConfig } from "./intent";
import type { BioactiveSignals, GtaDish, NutrientProfile } from "./models";
import { computeBaselineHealthScore } from "./scoring-engine";

export type CookingMethod = "grilled_roasted_baked" | "steamed_raw_fresh" | "sauteed_stir_fried" | "fried_battered" | "mixed_unclear";
export type CaloriesBand = "under_300" | "300_500" | "500_700" | "700_900" | "900_1200" | "over_1200";
export type ProteinBand = "under_15g" | "15_30g" | "over_30g";
export type ItemKind = "main" | "side" | "drink" | "dessert" | "sauce_or_extra" | "combo_or_bundle";
export type VegetableContent = "none" | "some" | "half_plate_or_more";
export type MainProtein = "chicken" | "fish_seafood" | "beef_lamb" | "pork" | "plant" | "egg_dairy" | "none";
export type PortionBand = "small" | "regular" | "large" | "xl";

export interface UsdaComponent {
  id: string;
  label: string;
  fdcId: number;
  description: string;
  defaultGrams: number;
  per100g: Record<string, number | null>;
  flags: { cruciferous: boolean; solubleFibre: boolean; wholeGrain: boolean; hemeRedMeat: boolean; polyphenol: boolean; omega3OrMono: boolean };
}

export const USDA_COMPONENTS: UsdaComponent[] = (usda as { components: UsdaComponent[] }).components;
const BY_ID = new Map(USDA_COMPONENTS.map((c) => [c.id, c]));

export interface EstimatedComponent {
  slot: "protein" | "base" | "veg";
  id: string;
  grams: number;
  /** Filled in by the app for display; absent in the stored estimate. */
  label?: string;
}

export const COMPONENT_LABEL = new Map(USDA_COMPONENTS.map((c) => [c.id, c.label]));

export interface ItemHealthEstimate {
  engine: "microsoft-decision-1+usda";
  method: CookingMethod;
  vegetables: VegetableContent;
  /** The protein actually in the item as sold (options like "add chicken" do not count). */
  mainProtein: MainProtein;
  caloriesBand: CaloriesBand;
  caloriesEst: number;
  proteinBand: ProteinBand;
  kind: ItemKind;
  highSodium: number;
  highSugar: number;
  highSaturatedFat: number;
  wholeGrainOrLegume: number;
  redMeat: number;
  components: EstimatedComponent[];
  nutrients: NutrientProfile;
  bioactives: BioactiveSignals;
  /** 0-100, from the catalogue scoring engine. */
  score: number;
  estimatedAt: string;
}

export const CALORIES_MIDPOINT: Record<CaloriesBand, number> = {
  under_300: 220,
  "300_500": 400,
  "500_700": 600,
  "700_900": 800,
  "900_1200": 1050,
  over_1200: 1400,
};

const PORTION_MULTIPLIER: Record<PortionBand, number> = { small: 0.6, regular: 1, large: 1.5, xl: 2.2 };

const componentCriteria = (extra: Record<string, string>) =>
  Object.fromEntries([...USDA_COMPONENTS.map((c) => [c.id, c.label] as const), ...Object.entries(extra)]);

const PORTION = {
  type: "choice",
  instructions: "How big is this component's portion, relative to a typical restaurant serving?",
  criteria: { small: "Small / half portion", regular: "Regular single serving", large: "Large or generous", xl: "Extra large, double, or sharing size" },
} as const;

const QUESTIONS = {
  cooking_method: {
    type: "choice",
    instructions: "How is the main component of this menu item most likely prepared?",
    criteria: {
      grilled_roasted_baked: "Grilled, flame-grilled, roasted, baked, rotisserie, charbroiled",
      steamed_raw_fresh: "Steamed, poached, raw, fresh salad, sushi, cold bowl",
      sauteed_stir_fried: "Sautéed, stir-fried, pan-fried in some oil, wok",
      fried_battered: "Deep-fried, battered, breaded, crispy, tempura, chips, fries",
      mixed_unclear: "Cannot tell, or a mix of methods",
    },
  },
  vegetable_content: {
    type: "choice",
    instructions: "How much of the item is vegetables, salad or fruit?",
    criteria: { none: "No vegetables to speak of", some: "A garnish or a side portion of vegetables", half_plate_or_more: "Vegetables, greens or salad are at least half of the item" },
  },
  main_protein: {
    type: "choice",
    instructions: "Which protein is actually included in this item as sold? Ignore optional add-ons such as 'add chicken' or 'choice of protein'.",
    criteria: {
      chicken: "Chicken or turkey is included",
      fish_seafood: "Fish, salmon, tuna, shrimp or other seafood is included",
      beef_lamb: "Beef, steak or lamb is included",
      pork: "Pork, bacon, ham or sausage is included",
      plant: "Tofu, tempeh, beans, lentils, chickpeas or other plant protein is the protein",
      egg_dairy: "Eggs or cheese are the main protein",
      none: "No real protein component, e.g. a plain side, drink, dessert, sauce or vegetables only",
    },
  },
  protein_component: {
    type: "choice",
    instructions: "Pick the USDA food that best matches the protein component actually included in this item (not optional add-ons). Choose none if there is no protein component.",
    criteria: componentCriteria({ none: "No protein component" }),
  },
  protein_portion: PORTION,
  base_component: {
    type: "choice",
    instructions: "Pick the USDA food that best matches the starch, bread, grain or base of this item. Choose none if there is no base.",
    criteria: componentCriteria({ none: "No starch or base component" }),
  },
  base_portion: PORTION,
  veg_component: {
    type: "choice",
    instructions: "Pick the USDA food that best matches the vegetable, salad, sauce or side component of this item. Choose none if there is none.",
    criteria: componentCriteria({ none: "No vegetable or side component" }),
  },
  veg_portion: PORTION,
  calories_band: {
    type: "choice",
    instructions: "Estimate total calories for one serving as sold, including sides and sauces that are part of the item.",
    criteria: { under_300: "Under 300 kcal", "300_500": "300 to 500 kcal", "500_700": "500 to 700 kcal", "700_900": "700 to 900 kcal", "900_1200": "900 to 1200 kcal", over_1200: "Over 1200 kcal" },
  },
  protein_band: {
    type: "choice",
    instructions: "Estimate protein per serving.",
    criteria: { under_15g: "Under 15 g protein", "15_30g": "15 to 30 g protein", over_30g: "Over 30 g protein" },
  },
  item_kind: {
    type: "choice",
    instructions: "What kind of menu item is this?",
    criteria: {
      main: "A main dish or meal-sized item",
      side: "A side dish or small plate",
      drink: "A beverage",
      dessert: "A dessert or sweet",
      sauce_or_extra: "A sauce, dip, topping, add-on or utensil",
      combo_or_bundle: "A combo, bundle, platter or family meal with several items",
    },
  },
  high_sodium: { type: "noul", instructions: "Is this item likely high in sodium (over 800 mg per serving) from seasoning, sauces, cured meat or cheese?" },
  high_sugar: { type: "noul", instructions: "Is this item likely high in added sugar (over 15 g per serving)?" },
  high_saturated_fat: { type: "noul", instructions: "Is this item likely high in saturated fat (over 8 g per serving)?" },
  whole_grain_or_legume: { type: "noul", instructions: "Does this item include whole grains, beans, lentils or chickpeas?" },
  red_meat: { type: "noul", instructions: "Does this item contain beef, lamb, pork or processed red meat?" },
} as const;

type Answer = { choice?: string; confidence?: number; noul?: number };

const EMPTY: NutrientProfile = { calories: 0, proteinG: 0, carbsG: 0, fibreG: 0, sugarsG: 0, fatG: 0, saturatedFatG: 0, transFatG: 0, sodiumMg: 0, ironMg: 0, vitaminCMg: 0, potassiumMg: 0 };

/** Sum USDA per-100 g nutrients over the chosen components, then add seasoning Decision-1 flagged. */
export function nutrientsFromComponents(components: EstimatedComponent[], flags: { highSodium: number; highSugar: number; highSaturatedFat: number }): NutrientProfile {
  const n: NutrientProfile = { ...EMPTY };
  for (const c of components) {
    const comp = BY_ID.get(c.id);
    if (!comp) continue;
    const f = c.grams / 100;
    for (const key of Object.keys(EMPTY) as (keyof NutrientProfile)[]) {
      const v = comp.per100g[key];
      if (typeof v === "number") n[key] = ((n[key] as number) ?? 0) + v * f;
    }
  }
  // Restaurant seasoning and sauces that USDA generics do not carry.
  if (flags.highSodium > 0.5) n.sodiumMg += 350 + 450 * flags.highSodium;
  if (flags.highSugar > 0.5) { n.sugarsG += 12 * flags.highSugar; n.carbsG += 12 * flags.highSugar; n.calories += 48 * flags.highSugar; }
  if (flags.highSaturatedFat > 0.5) { n.saturatedFatG += 4 * flags.highSaturatedFat; n.fatG += 4 * flags.highSaturatedFat; n.calories += 36 * flags.highSaturatedFat; }
  for (const key of Object.keys(n) as (keyof NutrientProfile)[]) {
    const v = n[key];
    if (typeof v === "number") (n as unknown as Record<string, number | null>)[key] = Math.round(v * 10) / 10;
  }
  n.calories = Math.round(n.calories);
  n.sodiumMg = Math.round(n.sodiumMg);
  return n;
}

export function bioactivesFromComponents(components: EstimatedComponent[], nutrients: NutrientProfile, e: { wholeGrainOrLegume: number; redMeat: number; vegetables: VegetableContent }): BioactiveSignals {
  const comps = components.map((c) => BY_ID.get(c.id)).filter((c): c is UsdaComponent => Boolean(c));
  const any = (k: keyof UsdaComponent["flags"]) => comps.some((c) => c.flags[k]);
  return {
    hasCruciferous: any("cruciferous"),
    hasSolubleFibreSource: any("solubleFibre") || e.wholeGrainOrLegume > 0.6,
    hasIntactWholeGrains: any("wholeGrain"),
    hasHemeIronRedMeat: any("hemeRedMeat") || e.redMeat > 0.6,
    hasPolyphenolChelate: any("polyphenol") || e.vegetables === "half_plate_or_more",
    hasOmega3OrMonoFat: any("omega3OrMono"),
    isLowCalorieFastingRisk: nutrients.calories < 320,
  };
}

/** A catalogue-shaped dish so the catalogue scoring engine and biomarker lenses can run on an estimate. */
export function toSyntheticDish(
  est: ItemHealthEstimate,
  meta: { id: string; name: string; restaurant: string; description: string; priceCad: number | null; publishedCalories?: number | null }
): GtaDish {
  let nutrients = est.nutrients;
  // Anchor to the calories Uber publishes for chains when the estimate is off by more than 15 %.
  if (meta.publishedCalories && est.nutrients.calories > 0) {
    const ratio = meta.publishedCalories / est.nutrients.calories;
    if (Math.abs(ratio - 1) > 0.15) {
      nutrients = { ...est.nutrients };
      for (const key of ["calories", "proteinG", "carbsG", "fibreG", "sugarsG", "fatG", "saturatedFatG", "sodiumMg", "potassiumMg", "ironMg"] as const) {
        const v = nutrients[key];
        if (typeof v === "number") (nutrients as unknown as Record<string, number | null>)[key] = Math.round(v * ratio * 10) / 10;
      }
      nutrients.calories = meta.publishedCalories;
    }
  }
  const components = est.components.map((c) => `${BY_ID.get(c.id)?.label ?? c.id} ${c.grams} g`);
  return {
    id: meta.id,
    name: meta.name,
    restaurant: meta.restaurant,
    brandSlug: meta.restaurant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: est.kind === "drink" ? "smoothies" : est.vegetables === "half_plate_or_more" && est.kind === "main" ? "salads" : "plates",
    servingSize: `${est.components.reduce((n, c) => n + c.grams, 0)} g est.`,
    priceCad: meta.priceCad ?? 0,
    description: meta.description,
    ingredients: components,
    allergens: [],
    nutrients,
    bioactives: est.bioactives,
    locations: [],
    nutritionSourceTitle: "Estimate from the menu text and reference foods",
    nutritionSourceUrl: "https://fdc.nal.usda.gov/",
    nutritionVerifiedDate: est.estimatedAt.slice(0, 10),
  };
}

export async function estimateItemHealth(
  item: { restaurant: string; name: string; description: string; section: string | null; price: number | null },
  config: DecisionConfig
): Promise<ItemHealthEstimate> {
  if (!config.apiKey || !config.endpoint) throw new Error("Decision-1 key not configured");
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": config.apiKey },
    body: JSON.stringify({
      model: config.deployment ?? "decision-1",
      state: JSON.stringify({
        context: "Restaurant menu item from Uber Eats in Toronto. Estimate what is in it and how much, from the name, description and menu section.",
        restaurant: item.restaurant,
        item: item.name,
        description: item.description,
        section: item.section,
        price_cad: item.price,
      }),
      questions: QUESTIONS,
    }),
  });
  if (!res.ok) throw new Error(`Decision-1 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = (await res.json()) as { answers: Record<string, Answer> };
  const a = raw.answers;
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const c = a[key]?.choice as T | undefined;
    return c && allowed.includes(c) ? c : fallback;
  };
  const n = (key: string) => Number((a[key]?.noul ?? 0).toFixed(3));
  const portion = (key: string): PortionBand => pick(key, ["small", "regular", "large", "xl"] as const, "regular");
  const kindEarly = pick("item_kind", ["main", "side", "drink", "dessert", "sauce_or_extra", "combo_or_bundle"] as const, "main");
  const smallKind = kindEarly === "side" || kindEarly === "sauce_or_extra" || kindEarly === "dessert" || kindEarly === "drink";
  const component = (slot: EstimatedComponent["slot"], key: string, portionKey: string): EstimatedComponent | null => {
    const id = a[key]?.choice;
    const comp = id ? BY_ID.get(id) : undefined;
    if (!comp) return null;
    // Sides and extras never get "extra large" portions; that is how edamame became 600 kcal.
    let band = portion(portionKey);
    if (smallKind && band === "xl") band = "large";
    if (smallKind && slot !== "protein" && band === "large") band = "regular";
    return { slot, id: comp.id, grams: Math.round(comp.defaultGrams * PORTION_MULTIPLIER[band]) };
  };

  const flags = { highSodium: n("high_sodium"), highSugar: n("high_sugar"), highSaturatedFat: n("high_saturated_fat"), wholeGrainOrLegume: n("whole_grain_or_legume"), redMeat: n("red_meat") };
  const components = [component("protein", "protein_component", "protein_portion"), component("base", "base_component", "base_portion"), component("veg", "veg_component", "veg_portion")]
    .filter((c): c is EstimatedComponent => Boolean(c))
    // The same USDA food picked for two slots is almost always one portion described twice.
    .filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i);
  const caloriesBand = pick("calories_band", ["under_300", "300_500", "500_700", "700_900", "900_1200", "over_1200"] as const, "500_700");
  const vegetables = pick("vegetable_content", ["none", "some", "half_plate_or_more"] as const, "some");
  let nutrients = nutrientsFromComponents(components, flags);
  if (components.length === 0) {
    // No USDA match: fall back to the calorie band alone.
    nutrients = { ...EMPTY, calories: CALORIES_MIDPOINT[caloriesBand] };
  } else {
    // Blend with Decision-1's independent calorie read to damp portion mistakes; lean on the band when the
    // USDA sum for a side or extra is more than double it.
    const mid = CALORIES_MIDPOINT[caloriesBand];
    const usdaWeight = smallKind && nutrients.calories > mid * 2 ? 0.3 : 0.7;
    const blended = Math.round(nutrients.calories * usdaWeight + mid * (1 - usdaWeight));
    const ratio = nutrients.calories > 0 ? blended / nutrients.calories : 1;
    for (const key of ["calories", "proteinG", "carbsG", "fibreG", "sugarsG", "fatG", "saturatedFatG", "sodiumMg", "potassiumMg", "ironMg", "vitaminCMg"] as const) {
      const v = nutrients[key];
      if (typeof v === "number") (nutrients as unknown as Record<string, number | null>)[key] = Math.round(v * ratio * 10) / 10;
    }
    nutrients.calories = blended;
    nutrients.sodiumMg = Math.round(nutrients.sodiumMg);
  }
  const bioactives = bioactivesFromComponents(components, nutrients, { wholeGrainOrLegume: flags.wholeGrainOrLegume, redMeat: flags.redMeat, vegetables });

  const partial = {
    method: pick("cooking_method", ["grilled_roasted_baked", "steamed_raw_fresh", "sauteed_stir_fried", "fried_battered", "mixed_unclear"] as const, "mixed_unclear"),
    vegetables,
    mainProtein: pick("main_protein", ["chicken", "fish_seafood", "beef_lamb", "pork", "plant", "egg_dairy", "none"] as const, "none"),
    caloriesBand,
    caloriesEst: nutrients.calories,
    proteinBand: pick("protein_band", ["under_15g", "15_30g", "over_30g"] as const, "15_30g"),
    kind: pick("item_kind", ["main", "side", "drink", "dessert", "sauce_or_extra", "combo_or_bundle"] as const, "main"),
    ...flags,
    components,
    nutrients,
    bioactives,
    estimatedAt: new Date().toISOString(),
  };
  const est: ItemHealthEstimate = { engine: "microsoft-decision-1+usda", ...partial, score: 0 };
  const dish = toSyntheticDish(est, { id: "est", name: item.name, restaurant: item.restaurant, description: item.description, priceCad: item.price });
  let score = computeBaselineHealthScore(dish).score;
  if (est.method === "fried_battered") score -= 8;
  if (est.kind === "dessert") score -= 10;
  est.score = Math.max(0, Math.min(100, Math.round(score)));
  return est;
}

/** Lenient validation for estimates coming back from the dataset file or /api/ingest. */
export function readEstimate(v: unknown): ItemHealthEstimate | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.score !== "number" || typeof o.caloriesBand !== "string" || typeof o.mainProtein !== "string") return null;
  if (!o.nutrients || typeof o.nutrients !== "object" || !Array.isArray(o.components)) return null;
  return o as unknown as ItemHealthEstimate;
}
