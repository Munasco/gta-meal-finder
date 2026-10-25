/**
 * Three published food-quality systems, computed for one dish from the same nutrients the health score uses.
 *
 *  - Nutri-Score (2023 algorithm, per 100 g): letter A (best) to E. Needs the portion mass.
 *  - Harvard AHEI-2010, adapted to a single meal: daily targets ÷ 3; alcohol cannot be judged from one
 *    order, so the ten assessable components (0–100) are scaled to the index's 0–110 range.
 *  - Health Canada front-of-package "high in" symbols: sodium, sugars, saturated fat at ≥ 15 % of the daily
 *    value per serving, or ≥ 30 % for main dishes of 200 g and more.
 *
 * Masses of vegetables, fruit, legumes, whole grains, red meat and fish come from the USDA components
 * Decision-1 picked (estimates) or from ingredient text (verified catalogue), so every number here is
 * labelled an estimate in the UI.
 */
import type { GtaDish, NutrientProfile } from "./models";

export type NutriGrade = "A" | "B" | "C" | "D" | "E";
export type HighIn = "sodium" | "sugars" | "saturated_fat";

export type AheiComponentId = "vegetables" | "fruit" | "whole_grains" | "ssb" | "nuts_legumes" | "red_meat" | "trans_fat" | "omega3" | "pufa" | "sodium";

export interface AheiComponent {
  id: AheiComponentId;
  points: number;
}

export const AHEI_LABEL: Record<AheiComponentId, string> = {
  vegetables: "Vegetables",
  fruit: "Whole fruit",
  whole_grains: "Whole grains",
  ssb: "Sugary drinks & juice",
  nuts_legumes: "Nuts & legumes",
  red_meat: "Red & processed meat",
  trans_fat: "Trans fat",
  omega3: "Long-chain omega-3",
  pufa: "Polyunsaturated fat",
  sodium: "Sodium",
};

export interface DishIndices {
  nutriScore: { grade: NutriGrade; points: number } | null;
  ahei: { score: number; components: AheiComponent[] };
  healthCanada: { highIn: HighIn[]; thresholdPct: 15 | 30 };
}

/** What a portion is made of, in grams; null when unknown. */
export interface Composition {
  nutrients: NutrientProfile;
  grams: number | null;
  vegG: number;
  fruitG: number;
  legumeG: number;
  nutG: number;
  wholeGrainG: number;
  redMeatG: number;
  fishG: number;
  isDrink: boolean;
  isSugaryDrink: boolean;
  isMain: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const steps = (v: number, thresholds: number[]) => thresholds.filter((t) => v > t).length;
const r1 = (v: number) => Math.round(v * 10) / 10;

/* ------------------------------- Nutri-Score ------------------------------ */

const KJ_PER_KCAL = 4.184;
const FOOD = {
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  satFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  sodium: Array.from({ length: 20 }, (_, i) => 80 * (i + 1)),
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  fibre: [3.0, 4.1, 5.2, 6.3, 7.4],
};
const DRINK = {
  energy: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  sugars: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
};

export function nutriScore(c: Composition): DishIndices["nutriScore"] {
  if (!c.grams || c.grams < 20) return null;
  const per = 100 / c.grams;
  const n = c.nutrients;
  const kj = n.calories * KJ_PER_KCAL * per;
  const fvlPct = ((c.vegG + c.fruitG + c.legumeG) / c.grams) * 100;
  const fvl = fvlPct > 80 ? 5 : fvlPct > 60 ? 2 : fvlPct > 40 ? 1 : 0;
  if (c.isDrink) {
    const neg = steps(kj, DRINK.energy) + steps(n.sugarsG * per, DRINK.sugars) + steps(n.saturatedFatG * per, FOOD.satFat) + steps(n.sodiumMg * per, FOOD.sodium);
    const pos = fvl + steps(n.fibreG * per, FOOD.fibre) + steps(n.proteinG * per, FOOD.protein);
    const points = neg - pos;
    return { grade: points <= 2 ? "B" : points <= 6 ? "C" : points <= 9 ? "D" : "E", points };
  }
  const neg = steps(kj, FOOD.energy) + steps(n.sugarsG * per, FOOD.sugars) + steps(n.saturatedFatG * per, FOOD.satFat) + steps(n.sodiumMg * per, FOOD.sodium);
  let protein = steps(n.proteinG * per, FOOD.protein);
  if (c.redMeatG > 0 && c.redMeatG >= c.grams * 0.3) protein = Math.min(protein, 2);
  const countProtein = neg < 11 || fvl === 5;
  const pos = fvl + steps(n.fibreG * per, FOOD.fibre) + (countProtein ? protein : 0);
  const points = neg - pos;
  return { grade: points <= 0 ? "A" : points <= 2 ? "B" : points <= 10 ? "C" : points <= 18 ? "D" : "E", points };
}

/* ----------------------------------- AHEI ---------------------------------- */

export function ahei(c: Composition): DishIndices["ahei"] {
  const n = c.nutrients;
  const kcal = Math.max(1, n.calories);
  const pct = (g: number) => ((g * 9) / kcal) * 100;
  const vegServ = c.vegG / 80;
  const fruitServ = c.fruitG / 120;
  const transPct = pct(n.transFatG);
  const pufaPct = pct(Math.max(0, n.fatG - n.saturatedFatG) * 0.35);
  const n3Mg = c.fishG * 10;
  // Each component 0–10, daily AHEI-2010 targets divided by three for one meal.
  const raw: [AheiComponentId, number][] = [
    ["vegetables", (vegServ / 1.67) * 10],
    ["fruit", (fruitServ / 1.33) * 10],
    ["whole_grains", (c.wholeGrainG / 70) * 10],
    ["ssb", c.isSugaryDrink ? 0 : 10],
    ["nuts_legumes", ((c.legumeG + c.nutG * 3) / 30) * 10],
    ["red_meat", 10 - (c.redMeatG / 50) * 10],
    ["trans_fat", 10 - ((transPct - 0.5) / 3.5) * 10],
    ["omega3", (n3Mg / 83) * 10],
    ["pufa", ((pufaPct - 2) / 8) * 10],
    ["sodium", 10 - ((n.sodiumMg - 400) / 750) * 10],
  ];
  const components: AheiComponent[] = raw.map(([id, pts]) => ({ id, points: r1(clamp(pts, 0, 10)) }));
  const sum = components.reduce((s, x) => s + x.points, 0);
  return { score: Math.round(sum * 1.1), components };
}

/* ------------------------------ Health Canada ------------------------------ */

const DAILY_VALUE = { sodium: 2300, sugars: 100, saturated_fat: 20 } as const;

export function healthCanada(c: Composition): DishIndices["healthCanada"] {
  // The 30 % threshold is for main dishes of 200 g and more; with no mass, only a main of plate-sized energy qualifies.
  const bigMeal = c.isMain && (c.grams !== null ? c.grams >= 200 : c.nutrients.calories >= 400);
  const thresholdPct: 15 | 30 = bigMeal ? 30 : 15;
  const n = c.nutrients;
  const over = (v: number, dv: number) => v / dv >= thresholdPct / 100;
  const highIn: HighIn[] = [];
  if (over(n.sodiumMg, DAILY_VALUE.sodium)) highIn.push("sodium");
  if (over(n.sugarsG, DAILY_VALUE.sugars)) highIn.push("sugars");
  if (over(n.saturatedFatG, DAILY_VALUE.saturated_fat)) highIn.push("saturated_fat");
  return { highIn, thresholdPct };
}

export function computeIndices(c: Composition): DishIndices {
  return { nutriScore: nutriScore(c), ahei: ahei(c), healthCanada: healthCanada(c) };
}

/* ------------------------------ compositions ------------------------------- */

/** How much of each USDA component counts toward a food group (share of its mass). */
const GROUP_SHARE: Record<string, Partial<Record<"veg" | "fruit" | "legume" | "nut" | "wholeGrain" | "redMeat" | "fish", number>>> = {
  salad_greens: { veg: 1 }, broccoli_cooked: { veg: 1 }, kale: { veg: 1 }, mixed_vegetables: { veg: 1 }, spinach_cooked: { veg: 1 }, coleslaw: { veg: 0.8 },
  fruit: { fruit: 1 }, avocado: { fruit: 1 },
  lentils_cooked: { legume: 1 }, chickpeas_cooked: { legume: 1 }, black_beans_cooked: { legume: 1 }, refried_beans: { legume: 1 }, hummus: { legume: 0.8 },
  falafel: { legume: 0.7 }, edamame: { legume: 1 }, tofu_firm: { legume: 1 }, tempeh: { legume: 1 }, burrito_beef_bean: { legume: 0.25, redMeat: 0.3 },
  nuts: { nut: 1 }, tahini: { nut: 1 },
  brown_rice_cooked: { wholeGrain: 1 }, quinoa_cooked: { wholeGrain: 1 }, oats: { wholeGrain: 1 }, corn: { wholeGrain: 1, veg: 0 },
  beef_steak_grilled: { redMeat: 1 }, beef_ground_patty: { redMeat: 1 }, lamb_roasted: { redMeat: 1 }, pork_loin: { redMeat: 1 }, bacon: { redMeat: 1 }, sausage: { redMeat: 1 }, taco: { redMeat: 0.4 },
  salmon_cooked: { fish: 1 }, tuna: { fish: 0.5 }, white_fish_baked: { fish: 0.3 }, shrimp_cooked: { fish: 0.3 }, shrimp_breaded: { fish: 0.2 },
};
const SUGARY_DRINK_IDS = new Set(["soda", "juice", "milkshake"]);

export function compositionFromComponents(
  components: { id: string; grams: number }[],
  nutrients: NutrientProfile,
  kind: "main" | "side" | "drink" | "dessert" | "sauce_or_extra" | "combo_or_bundle"
): Composition {
  const c: Composition = { nutrients, grams: 0, vegG: 0, fruitG: 0, legumeG: 0, nutG: 0, wholeGrainG: 0, redMeatG: 0, fishG: 0, isDrink: kind === "drink", isSugaryDrink: false, isMain: kind === "main" || kind === "combo_or_bundle" };
  for (const comp of components) {
    c.grams! += comp.grams;
    const share = GROUP_SHARE[comp.id] ?? {};
    c.vegG += comp.grams * (share.veg ?? 0);
    c.fruitG += comp.grams * (share.fruit ?? 0);
    c.legumeG += comp.grams * (share.legume ?? 0);
    c.nutG += comp.grams * (share.nut ?? 0);
    c.wholeGrainG += comp.grams * (share.wholeGrain ?? 0);
    c.redMeatG += comp.grams * (share.redMeat ?? 0);
    c.fishG += comp.grams * (share.fish ?? 0);
    if (SUGARY_DRINK_IDS.has(comp.id)) c.isSugaryDrink = true;
  }
  if (c.isDrink && nutrients.sugarsG >= 10) c.isSugaryDrink = true;
  if (!c.grams) c.grams = null;
  return c;
}

/** Verified catalogue dishes publish nutrients and a serving size, not component masses: read the ingredients. */
export function compositionFromDish(dish: GtaDish): Composition {
  const grams = Number(/\b(\d+(?:\.\d+)?)\s*g\b/i.exec(dish.servingSize)?.[1]) || null;
  const text = `${dish.name} ${dish.ingredients.join(" ")} ${dish.description}`.toLowerCase();
  const has = (re: RegExp) => re.test(text);
  const g = grams ?? 400;
  const isDrink = dish.category === "smoothies";
  const vegShare = dish.category === "salads" ? 0.5 : dish.bioactives.hasCruciferous ? 0.35 : has(/\b(vegetable|veggie|greens|broccoli|spinach|kale|cabbage|slaw|pepper|tomato|cucumber|lettuce|salad)/) ? 0.2 : 0;
  return {
    nutrients: dish.nutrients,
    grams,
    vegG: g * vegShare,
    fruitG: has(/\b(avocado|berr|mango|apple|banana|fruit|pineapple|orange)/) ? g * (isDrink ? 0.4 : 0.1) : 0,
    legumeG: has(/\b(bean|lentil|chickpea|hummus|edamame|tofu|falafel)/) ? g * 0.2 : 0,
    nutG: has(/\b(almond|walnut|cashew|peanut|pecan|seeds?)\b/) ? 10 : 0,
    wholeGrainG: dish.bioactives.hasIntactWholeGrains ? g * 0.3 : 0,
    redMeatG: dish.bioactives.hasHemeIronRedMeat ? g * 0.25 : 0,
    fishG: has(/\b(salmon|tuna|fish|shrimp|prawn|seafood)/) ? g * 0.3 : 0,
    isDrink,
    isSugaryDrink: isDrink && dish.nutrients.sugarsG >= 10 && !has(/\bno added sugar|unsweetened/),
    isMain: !isDrink,
  };
}

export const NUTRI_COLORS: Record<NutriGrade, string> = { A: "#038141", B: "#85BB2F", C: "#FECB02", D: "#EE8100", E: "#E63E11" };
export const HIGH_IN_LABEL: Record<HighIn, string> = { sodium: "High in sodium", sugars: "High in sugars", saturated_fat: "High in saturated fat" };
