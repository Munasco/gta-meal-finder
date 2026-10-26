import { GTA_DISH_CATALOGUE } from "./gta-catalogue";
import { ALLERGEN_KEYWORDS, type MealIntent, type TasteProfile } from "./intent";
import type { BidirectionalAdjustment, BiomarkerLensId, EvaluatedDish, GtaDish, ScoreComponent } from "./models";
import { compositionFromComponents, compositionFromDish, computeIndices, type DishIndices } from "./indices";
import { evaluateDish } from "./scoring-engine";
import { COMPONENT_LABEL, readEstimate, toSyntheticDish, type ItemHealthEstimate } from "./health-estimate";
import { searchLocalDataset } from "./dataset-local";
import { dishPattern, isDish } from "./dish-words";

/* ---------------------------------- types --------------------------------- */

export type MenuSource = "dataset" | "catalogue";

export interface MenuOption {
  id: string;
  name: string;
  description: string;
  priceCad: number | null;
  restaurant: string;
  section: string | null;
  imageUrl: string | null;
  url: string | null;
  source: MenuSource;
  /** 0-100 health heuristic (or the catalogue's combined score when nutrition is known). */
  healthScore: number;
  /** 0-100 how well the item matches the request (protein, lens, portion). */
  fitScore: number;
  portionScore: number;
  kind: "main" | "side" | "extra";
  reasons: string[];
  cautions: string[];
  /** Deal text when the item itself is a BOGO / 2-for-1. */
  promo: string | null;
  /** Verified (catalogue) or Decision-1 estimated calories. */
  calories: number | null;
  caloriesEstimated: boolean;
  health: OptionHealth | null;
  /** Scoring-engine drivers and nutrients, trimmed to what the UI shows; present when nutrition is known or estimated. */
  evaluated?: OptionEvaluation;
  /** Nutri-Score, meal-adapted AHEI and Health Canada "high in" flags; null without nutrition. */
  indices: DishIndices | null;
}

/** What the UI shows of an estimate (nutrients travel in `evaluated.dish`); the wire format for `MenuOption.health`. */
export type OptionHealth = Pick<ItemHealthEstimate, "caloriesBand" | "caloriesEst" | "mainProtein" | "kind" | "components">;

/** The parts of `EvaluatedDish` the cards and sheet render. The full object stays on the server. */
export interface OptionEvaluation {
  /** Drivers worth at least a point; labels come from `driverLabel(id)` on the client. */
  baselineComponents: Pick<ScoreComponent, "id" | "direction" | "points" | "metricDisplay">[];
  takeMoreOfHits: Pick<BidirectionalAdjustment, "nutrientOrFood" | "dishValueDisplay">[];
  takeLessOfChecks: Pick<BidirectionalAdjustment, "nutrientOrFood" | "dishValueDisplay" | "status">[];
  dish: Pick<GtaDish, "servingSize" | "nutrients" | "nutritionSourceTitle" | "nutritionSourceUrl">;
}

export function slimEvaluation(ev: EvaluatedDish): OptionEvaluation {
  return {
    baselineComponents: ev.baselineComponents.filter((c) => Math.abs(c.points) >= 1).map(({ id, direction, points, metricDisplay }) => ({ id, direction, points, metricDisplay })),
    takeMoreOfHits: ev.takeMoreOfHits.slice(0, 3).map(({ nutrientOrFood, dishValueDisplay }) => ({ nutrientOrFood, dishValueDisplay })),
    takeLessOfChecks: ev.takeLessOfChecks.filter((c) => c.status === "caution").slice(0, 3).map(({ nutrientOrFood, dishValueDisplay, status }) => ({ nutrientOrFood, dishValueDisplay, status })),
    dish: { servingSize: ev.dish.servingSize, nutrients: ev.dish.nutrients, nutritionSourceTitle: ev.dish.nutritionSourceTitle, nutritionSourceUrl: ev.dish.nutritionSourceUrl },
  };
}

function slimHealth(est: ItemHealthEstimate): OptionHealth {
  return {
    caloriesBand: est.caloriesBand,
    caloriesEst: est.caloriesEst,
    mainProtein: est.mainProtein,
    kind: est.kind,
    components: est.components.map((c) => ({ ...c, label: COMPONENT_LABEL.get(c.id) ?? c.id })),
  };
}

/** A combo lists its items by reference; the full option is in `RestaurantGroup.options`. */
export type ComboItem = Pick<MenuOption, "id" | "name" | "priceCad" | "kind">;

export interface ComboPlan {
  items: ComboItem[];
  /** Menu prices added up. */
  subtotalCad: number;
  /** Money the deal takes off (BOGO: the cheaper main is free). */
  discountCad: number;
  dealLabel: string | null;
  /** Net cost before tax and fees (subtotal − discount). */
  netCad: number;
  estimatedFeesCad: number;
  estimatedTotalCad: number;
  budgetCad: number | null;
  fitsBudget: boolean;
}

export interface Deal {
  kind: "bogo" | "free_item" | "amount_off" | "percent_off";
  label: string;
  amount?: number;
  minSubtotal?: number;
  percent?: number;
}

export function parseDeals(promos: string[]): Deal[] {
  const deals: Deal[] = [];
  for (const p of promos) {
    let m: RegExpMatchArray | null;
    if (/buy \d+,? get \d+|\bbogo\b|2 for 1|two for one/i.test(p)) deals.push({ kind: "bogo", label: p });
    else if (/free item/i.test(p)) deals.push({ kind: "free_item", label: p });
    else if ((m = p.match(/\$(\d+(?:\.\d+)?) off(?:\s*\$(\d+)\+?)?/i))) deals.push({ kind: "amount_off", label: p, amount: Number(m[1]), minSubtotal: m[2] ? Number(m[2]) : 0 });
    else if ((m = p.match(/(\d+)% off/i))) deals.push({ kind: "percent_off", label: p, percent: Number(m[1]) });
  }
  return deals;
}

/** Best single deal for a set of items. BOGO makes the second-priciest main free. */
export function dealDiscount(items: MenuOption[], subtotal: number, deals: Deal[]): { discount: number; label: string | null } {
  let best = { discount: 0, label: null as string | null };
  const priced = items.filter((i) => i.priceCad !== null);
  const mains = priced.filter((i) => i.kind === "main").map((i) => i.priceCad!).sort((a, b) => b - a);
  for (const d of deals) {
    let discount = 0;
    if (d.kind === "bogo" && mains.length >= 2) discount = mains[1];
    else if (d.kind === "free_item" && priced.length >= 2) discount = Math.min(...priced.map((i) => i.priceCad!));
    else if (d.kind === "amount_off" && subtotal >= (d.minSubtotal ?? 0)) discount = Math.min(d.amount ?? 0, subtotal);
    else if (d.kind === "percent_off") discount = (subtotal * (d.percent ?? 0)) / 100;
    if (discount > best.discount) best = { discount, label: d.label };
  }
  return best;
}

export interface RestaurantGroup {
  restaurant: string;
  storeUrl: string | null;
  doorDashUrl: string | null;
  rating: number | null;
  etaText: string | null;
  source: MenuSource;
  /** Store-level deals from Uber Eats, e.g. "Buy 1, get 1". */
  promos: string[];
  geo: { lat: number; lng: number } | null;
  /** Straight-line distance from the delivery point, when the store's coordinates are known. */
  distanceKm: number | null;
  /** Other locations of the same brand that were collapsed into this card. */
  otherLocations: { restaurant: string; distanceKm: number | null; storeUrl: string | null }[];
  options: MenuOption[];
  combo: ComboPlan;
  rankScore: number;
}

export interface ProviderAttempt {
  provider: MenuSource;
  status: "used" | "skipped" | "failed";
  detail: string;
  latencyMs?: number;
  restaurants?: number;
}

export interface SearchOptions {
  /** Only restaurants or items with a BOGO / deal. */
  dealsOnly?: boolean;
  /** Delivery point; enables distances. */
  origin?: { lat: number; lng: number };
  /** Drop restaurants farther than this (only when their coordinates are known). */
  rangeKm?: number;
  /** Rank by closeness to this health score instead of "higher is better" (Gaussian, σ = 12). */
  targetScore?: number;
}

export interface MenuSearchResult {
  source: MenuSource;
  groups: RestaurantGroup[];
  attempts: ProviderAttempt[];
}

interface RawRestaurant {
  name: string;
  url: string | null;
  rating: number | null;
  etaText: string | null;
  promos?: string[];
  geo?: { lat: number; lng: number } | null;
  items: { name: string; description: string; price: number | null; section: string | null; imageUrl: string | null; url: string | null; health?: ItemHealthEstimate | null; calories?: number | null; likedPct?: number | null }[];
}

/* ------------------------------- utilities -------------------------------- */

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value > 500 ? value / 100 : value;
  if (typeof value === "string") {
    const m = value.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    if (m) return Number(m[1]);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return parsePrice(o.price ?? o.amount ?? o.value ?? o.priceText ?? o.formatted);
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

function cleanName(raw: string): string {
  const decoded = raw.replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
  // Only slug-like names (all lowercase, hyphenated) get title-cased; real names keep their casing.
  if (/^[a-z0-9-]+$/.test(decoded)) return decoded.replace(/-/g, " ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  return decoded;
}

function geoOf(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat ?? o.latitude);
  const lng = Number(o.lng ?? o.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function uberEatsSearchUrl(term: string): string {
  return `https://www.ubereats.com/ca/search?q=${encodeURIComponent(`${term} Toronto`)}`;
}

export function doorDashSearchUrl(term: string): string {
  return `https://www.doordash.com/search/store/${encodeURIComponent(`${term} Toronto`)}/`;
}

/** Walk any provider / MCP payload and pull out restaurants with menu items. */
export function normalizeRestaurants(payload: unknown): RawRestaurant[] {
  const out: RawRestaurant[] = [];
  const seen = new Set<string>();

  const itemsFrom = (o: Record<string, unknown>): RawRestaurant["items"] => {
    const lists: unknown[] = [];
    const direct = pick(o, ["menu_items", "menuItems", "allMenuItems", "items", "dishes", "products"]);
    if (Array.isArray(direct)) lists.push(...direct);
    const sections = pick(o, ["menuSections", "sections", "categories", "menu"]);
    const sectionArr = Array.isArray(sections)
      ? sections
      : sections && typeof sections === "object"
        ? (pick(sections as Record<string, unknown>, ["sections", "categories", "items"]) as unknown[] | undefined) ?? []
        : [];
    for (const s of sectionArr) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const sItems = pick(so, ["items", "menuItems", "dishes", "products"]);
      if (Array.isArray(sItems)) {
        for (const it of sItems) {
          if (it && typeof it === "object") lists.push({ ...(it as Record<string, unknown>), __section: str(so.name ?? so.title) });
        }
      } else if (str(so.name) && (so.price !== undefined || so.offers !== undefined)) {
        lists.push(s);
      }
    }
    return lists
      .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === "object")
      .map((it) => ({
        name: cleanName(str(pick(it, ["name", "title", "itemName"]))),
        description: cleanName(str(pick(it, ["description", "desc", "subtitle"]))),
        price: parsePrice(pick(it, ["price", "priceText", "offers", "amount", "priceCents"])),
        section: str(pick(it, ["__section", "section", "category", "sectionName"])) || null,
        imageUrl: str(pick(it, ["imageUrl", "image", "img", "thumbnail"])) || null,
        url: str(pick(it, ["url", "itemUrl", "link"])) || null,
        health: readEstimate(it.health),
        calories: typeof it.calories === "number" && it.calories > 0 ? Math.round(it.calories) : null,
        likedPct: typeof it.likedPct === "number" ? it.likedPct : null,
      }))
      .filter((it) => it.name.length > 1)
      .filter((it, i, arr) => arr.findIndex((o) => o.name.toLowerCase() === it.name.toLowerCase() && o.price === it.price) === i);
  };

  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const name = str(pick(o, ["store_name", "storeName", "restaurantName", "restaurant", "shopName", "title", "name"]));
    const items = itemsFrom(o);
    if (name && items.length > 0) {
      const key = slug(name);
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          name: cleanName(name),
          url: str(pick(o, ["storeUrl", "restaurantUrl", "url", "link"])) || null,
          rating: typeof o.rating === "number" ? o.rating : parsePrice(o.rating),
          etaText: str(pick(o, ["etaText", "eta", "deliveryTime"])) || null,
          promos: (Array.isArray(o.promos) ? o.promos : []).filter((x): x is string => typeof x === "string"),
          geo: geoOf(o.geo),
          items,
        });
      }
      return;
    }
    for (const v of Object.values(o)) visit(v, depth + 1);
  };
  visit(payload, 0);
  return out;
}

/* ------------------------------ heuristics -------------------------------- */

const POSITIVE: [RegExp, number, string][] = [
  [/\bgrill(ed)?|flame|roast(ed)?|baked|steamed|peri[- ]?peri|char/i, 14, "Grilled or roasted, not fried"],
  [/\bsalad|greens|kale|spinach|broccoli|cabbage|slaw\b/i, 12, "Vegetable-forward"],
  [/\bbowl|quinoa|brown rice|whole[- ]grain|farro|lentil|chickpea|hummus|bean/i, 10, "Whole grains or legumes"],
  [/\bavocado|olive oil|salmon|tuna/i, 8, "Healthy fats or omega-3"],
  [/\bbreast|lean|skinless|protein/i, 6, "Lean protein"],
  [/\bveg(etable|gie|etarian)?s?\b|corn on the cob|roasted veg/i, 6, "Includes vegetables"],
];

const NEGATIVE: [RegExp, number, string][] = [
  [/\bdeep[- ]fried|fried|crispy|battered|tempura|nuggets|tenders\b/i, 18, "Fried or battered"],
  [/\bcreamy|alfredo|cheesy|loaded|double|triple|bacon|sausage|pepperoni/i, 12, "High saturated fat"],
  [/\bfries|poutine|chips\b/i, 8, "Fried starch side"],
  [/\bdessert|cake|brownie|cookie|ice cream|milkshake|shake|cheesecake|donut|pastel/i, 20, "Dessert"],
];

/** Matched against the item name only, so a description like "add extra protein" does not demote a bowl. */
const NAME_ONLY_NEGATIVE: [RegExp, number, string][] = [
  [/\bsoda|pop|cola|sprite|lemonade|juice|drink|beverage|water|coffee|tea\b/i, 20, "Drink"],
  [/^(extra|add|side of)\b|\b(sauce|dip|dressing|add[- ]on)s?\b/i, 10, "Condiment or add-on"],
];

const LENS_RULES: Partial<Record<BiomarkerLensId, { boost: [RegExp, number, string][]; limit: [RegExp, number, string][] }>> = {
  bilirubin_elevated: {
    boost: [[/broccoli|kale|cabbage|slaw|brussels|bok choy/i, 8, "Cruciferous: supports bilirubin clearance"], [/bean|lentil|chickpea|oat|brown rice|quinoa/i, 6, "Soluble fibre"]],
    limit: [[/fried|creamy|bacon/i, 8, "Saturated fat strains the liver"]],
  },
  iron_high: {
    boost: [[/tofu|lentil|chickpea|bean|salad|greens/i, 8, "Plant protein and polyphenols moderate iron uptake"]],
    limit: [[/beef|steak|lamb|liver|burger/i, 20, "Heme iron from red meat"]],
  },
  iron_low: {
    boost: [[/beef|steak|lamb|spinach|lentil|chickpea/i, 10, "Iron-rich"], [/lemon|lime|pepper|tomato|citrus/i, 4, "Vitamin C boosts absorption"]],
    limit: [],
  },
  fatty_liver_masld: {
    boost: [[/salad|greens|grilled|fish|salmon/i, 8, "Low glycemic, lean"]],
    limit: [[/fried|creamy|sweet|honey|glaze|sugar|soda|dessert/i, 12, "Fat and sugar drive hepatic fat"]],
  },
  sodium_bp: {
    boost: [[/fresh|salad|avocado|banana|potato|bean/i, 6, "Potassium-rich"]],
    limit: [[/bacon|ham|salami|soy|teriyaki|pickled|brine|salted|cured|feta/i, 14, "High sodium"]],
  },
  glycemic_steady: {
    boost: [[/salad|grilled|protein|bowl|quinoa/i, 6, "Steadier glucose"]],
    limit: [[/sweet|honey|glaze|sugar|white rice|naan|bun|wrap|pita|dessert|juice/i, 12, "Refined carbs or sugar"]],
  },
};

const PORTION_WORDS: [RegExp, number][] = [
  [/\bfamily|feast|platter|sharing|share|whole chicken|full chicken|1\/2 chicken|half chicken|large|xl|double/i, 100],
  [/\bmeal|combo|plate|platter|bowl|burrito|wrap|rice|sides?\b|2 sides|two sides|regular/i, 70],
  [/\b1\/4 chicken|quarter|sandwich|burger|pita|salad/i, 55],
  [/\bsmall|mini|kids|snack|single|wing|dip|sauce|side\b/i, 20],
];

const PROTEIN_WORDS: Record<MealIntent["protein"], RegExp | null> = {
  chicken: /\b(chicken|poultry|turkey|frango|pollo)\b/i,
  fish: /\b(salmon|fish|tuna|cod|shrimp|prawns?|seafood|poke|crab|lobster)\b/i,
  plant: /\b(tofu|tempeh|lentils?|chickpeas?|beans?|falafel|halloumi|paneer|seitan)\b/i,
  beef: /\b(beef|steak|lamb|brisket|burger)\b/i,
  any: null,
};

const ESTIMATE_PROTEIN: Record<MealIntent["protein"], string[]> = {
  chicken: ["chicken"],
  fish: ["fish_seafood"],
  plant: ["plant"],
  beef: ["beef_lamb"],
  any: [],
};

/** Description text with optional add-ons removed, so "add chicken" or "choice of protein" never counts as chicken. */
function stripOptions(description: string): string {
  return description.replace(/\b(add|add-on|choice of|your choice of|choose|option(?:al|s)?|upgrade|sub(?:stitute)?|swap|or|with your)\b[^.,;]*/gi, " ");
}

const TASTE_WORDS: Record<TasteProfile, RegExp> = {
  warm_savory_grain_bowl: /\b(bowl|grain|quinoa|brown rice|lentil|farro|barley)\b/i,
  spicy_asian_lemongrass_satay: /\b(thai|lemongrass|satay|ginger|basil|wok|curry|pad|vietnamese|pho|korean|kimchi|szechuan|sichuan|teriyaki|ramen)\b/i,
  smoky_mexican_chipotle_lime: /\b(mexican|burrito|taco|chipotle|salsa|black beans?|lime|cilantro|fajita|quesadilla)\b/i,
  mediterranean_herb_olive_lemon: /\b(mediterranean|greek|shawarma|peri|portuguese|lemon|olive|hummus|falafel|kebab|kabab|souvlaki|pita|tzatziki|tahini)\b/i,
  crisp_superfood_greens_salad: /\b(salad|greens|kale|spinach|arugula|slaw)\b/i,
  high_protein_grilled_plate: /\b(grilled|plate|platter|steak|salmon|breast|protein|rotisserie|charcoal|tandoori)\b/i,
};

const SPICY = /\b(spicy|hot|peri|chili|chilli|jalape[nñ]o|sriracha|szechuan|sichuan|vindaloo|habanero|cajun|buffalo|nashville)\b/i;
const MEAT = /\b(chicken|beef|pork|lamb|bacon|ham|turkey|steak|sausage|pepperoni|salami|prosciutto|brisket|veal|duck|goat|mutton|wings?|burger|meatball|kebab|kabab|shawarma|gyro|jerk)\b/i;
const FISH = /\b(fish|salmon|tuna|shrimp|prawns?|crab|lobster|seafood|cod|tilapia|calamari|squid|octopus|anchov|sardine|scallop|clam|mussel|oyster|poke|sashimi|nigiri)\b/i;
const DAIRY = /\b(cheese|cheesy|cream|creamy|yogurt|yoghurt|butter|milk|paneer|halloumi|alfredo|mozzarella|cheddar|feta|parmesan|ricotta|ghee|mayo|ranch|caesar)\b/i;
const GLUTEN = /\b(bread|bun|wrap|pita|naan|roti|pasta|noodles?|ramen|udon|pizza|battered|breaded|crispy|tempura|dumplings?|gyoza|sandwich|sub|bagel|croissant|toast|tortilla|burrito|flour|couscous|barley|soy sauce|panko|katsu)\b/i;
const HIGH_CARB = /\b(rice|bread|bun|wrap|pita|naan|roti|pasta|noodles?|pizza|fries|potato|sugar|dessert|cake|cookie|pancake|waffle|bagel|sandwich|burrito|tortilla)\b/i;
const GF_NOTE = /gluten[- ]?free|\bgf\b|celiac/i;
const VEGAN_NOTE = /\bvegan|plant[- ]based\b/i;
const DF_NOTE = /dairy[- ]?free|\bvegan\b/i;

/** A hard dietary rule the item breaks, or null. Decision-1's read of the protein wins where available. */
function dietViolation(intent: MealIntent, name: string, description: string, est: ItemHealthEstimate | null): string | null {
  const hay = `${name} ${description}`;
  const protein = est?.mainProtein ?? null;
  const hasMeat = protein ? ["chicken", "beef_lamb", "pork"].includes(protein) : MEAT.test(name) || MEAT.test(stripOptions(description));
  const hasFish = protein ? protein === "fish_seafood" : FISH.test(name) || FISH.test(stripOptions(description));
  switch (intent.diet) {
    case "vegetarian":
      return hasMeat || hasFish ? "Not vegetarian" : null;
    case "vegan":
      if (VEGAN_NOTE.test(hay)) return null;
      return hasMeat || hasFish || (protein ? protein === "egg_dairy" : DAIRY.test(hay) || /\begg/i.test(hay)) ? "Not vegan" : null;
    case "pescatarian":
      return hasMeat ? "Not pescatarian" : null;
    case "gluten_free":
      if (GF_NOTE.test(hay)) return null;
      return GLUTEN.test(hay) || est?.method === "fried_battered" ? "Likely contains gluten" : null;
    case "dairy_free":
      if (DF_NOTE.test(hay)) return null;
      return DAIRY.test(hay) ? "Likely contains dairy" : null;
    case "keto_low_carb":
      if (est?.nutrients && est.nutrients.carbsG > 45) return `~${Math.round(est.nutrients.carbsG)} g carbs`;
      return !est?.nutrients && HIGH_CARB.test(name) ? "High-carb" : null;
    default:
      return null;
  }
}

/** Allergen the user excluded that this item mentions, or null. */
function allergenHit(intent: MealIntent, name: string, description: string): string | null {
  const hay = `${name} ${description}`.toLowerCase();
  for (const tag of intent.detectedAllergens) {
    if (tag === "gluten" && GF_NOTE.test(hay)) continue;
    if (tag === "dairy" && DF_NOTE.test(hay)) continue;
    const words = tag === "gluten" ? [...ALLERGEN_KEYWORDS.gluten, "bread", "pasta", "noodle", "wrap", "pita", "naan", "pizza", "breaded", "battered"] : ALLERGEN_KEYWORDS[tag];
    if (words.some((w) => new RegExp(`\\b${w}`, "i").test(hay))) return `Contains ${tag.replace("_", " ")}`;
  }
  return null;
}

function kindOf(name: string, description: string, price: number | null): MenuOption["kind"] {
  const hay = `${name} ${description}`;
  if (NAME_ONLY_NEGATIVE.some(([re]) => re.test(name))) return "extra";
  if (price !== null && price < 4) return "extra";
  if (/\bside|fries|chips|rice|slaw|corn|salad\b|hummus|pita bread|garlic bread|mash|veg/i.test(hay) && !/chicken|salmon|beef|tofu|bowl|wrap|burger|pita with|platter/i.test(hay)) return "side";
  if (price !== null && price < 8) return "side";
  return "main";
}

export function scoreOption(
  input: { name: string; description: string; priceCad: number | null; health?: ItemHealthEstimate | null; calories?: number | null },
  intent: MealIntent
): Pick<MenuOption, "healthScore" | "fitScore" | "portionScore" | "kind" | "reasons" | "cautions" | "promo" | "calories" | "caloriesEstimated" | "health"> & { blocked: string | null } {
  const hay = `${input.name} ${input.description}`;
  const reasons: string[] = [];
  const cautions: string[] = [];
  const est = input.health ?? null;
  const blocked = dietViolation(intent, input.name, input.description, est) ?? allergenHit(intent, input.name, input.description);
  let health = 55;

  for (const [re, pts, why] of POSITIVE) if (re.test(hay)) { health += pts; reasons.push(why); }
  for (const [re, pts, why] of NEGATIVE) if (re.test(hay)) { health -= pts; cautions.push(why); }
  for (const [re, pts, why] of NAME_ONLY_NEGATIVE) if (re.test(input.name)) { health -= pts; cautions.push(why); }
  const lens = LENS_RULES[intent.primaryLens];
  if (lens) {
    for (const [re, pts, why] of lens.boost) if (re.test(hay)) { health += pts; reasons.push(why); }
    for (const [re, pts, why] of lens.limit) if (re.test(hay)) { health -= pts; cautions.push(why); }
  }
  if (intent.limitFried > 0.6 && /fried|crispy|battered/i.test(hay)) health -= Math.round(10 * intent.limitFried);
  if (intent.noulWeights.limit_heme_red_meat > 0.6 && /beef|steak|lamb/i.test(hay)) health -= 10;

  let portion = 50;
  for (const [re, score] of PORTION_WORDS) if (re.test(hay)) { portion = score; break; }

  const kind = kindOf(input.name, input.description, input.priceCad);

  let fit = 50;
  const proteinRe = PROTEIN_WORDS[intent.protein];
  if (proteinRe) {
    // Decision-1's read of the item as sold wins; otherwise the name, then the description minus add-ons.
    const hasProtein = est
      ? ESTIMATE_PROTEIN[intent.protein].includes(est.mainProtein)
      : proteinRe.test(input.name) || proteinRe.test(stripOptions(input.description));
    if (hasProtein) { fit += 25; reasons.unshift(`Has ${intent.protein}`); }
    else if (kind === "main") { fit -= 25; cautions.push(`No ${intent.protein}`); }
  }
  // Portion: estimated mass (USDA component grams) beats calories, which beat words. A 900 kcal brownie is not a big plate.
  const grams = est?.components.length ? est.components.reduce((n, c) => n + c.grams, 0) : null;
  const kcal = input.calories ?? est?.caloriesEst ?? null;
  const band = (v: number, lo: number, hi: number, slopeLo: number, slopeHi: number) =>
    v < lo ? Math.max(10, 50 - (lo - v) / slopeLo) : v > hi ? Math.max(30, 70 - (v - hi) / slopeHi) : 70 + Math.min(30, (v - lo) / ((hi - lo) / 30));
  if (grams !== null && kind !== "extra") portion = intent.wantsLargePortions > 0.6 ? band(grams, 450, 800, 5, 12) : band(grams, 300, 600, 4, 8);
  else if (kcal !== null && kind !== "extra") portion = intent.wantsLargePortions > 0.6 ? band(kcal, 650, 1000, 6, 10) : band(kcal, 400, 750, 6, 10);
  fit += (portion - 50) * (intent.wantsLargePortions > 0.6 ? 0.5 : 0.2);
  // Taste, cuisine and spice from the request.
  if (intent.tasteConfidence >= 0.5 && TASTE_WORDS[intent.tasteProfile].test(hay)) { fit += 8; reasons.push("Matches your taste"); }
  if (intent.cuisineHint && new RegExp(intent.cuisineHint.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i").test(hay)) fit += 6;
  // The literal dish the user typed ("jerk", "pho") on the item itself is the strongest fit signal there is.
  if (intent.dishWord && dishPattern(intent.dishWord).test(input.name)) { fit += 20; reasons.unshift(`It's ${intent.dishWord}`); }
  if (intent.valueFocus > 0.6 && input.priceCad !== null && kind === "main") fit += Math.max(-10, Math.min(10, (18 - input.priceCad) * 1.2));
  // Ingredients the user asked for, found in the item (name counts double).
  for (const ing of intent.wantedIngredients) {
    const re = new RegExp(`\\b${ing.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}`, "i");
    if (re.test(input.name)) { fit += 12; reasons.push(`Has ${ing}`); }
    else if (re.test(input.description)) { fit += 7; reasons.push(`Has ${ing}`); }
  }
  if (intent.wantsSpicy >= 0.6 && SPICY.test(hay)) { fit += 6; reasons.push("Spicy"); }
  else if (intent.wantsSpicy <= 0.25 && SPICY.test(input.name)) fit -= 6;
  if (intent.protein !== "any" && est?.proteinBand === "over_30g") fit += 5;
  for (const ex of intent.detectedIngredientExclusions) {
    if (ex && hay.toLowerCase().includes(ex)) { fit -= 40; cautions.push(`Contains ${ex}`); }
  }
  if (intent.budgetCad !== null && input.priceCad !== null && input.priceCad > intent.budgetCad) {
    fit -= 40;
    cautions.push("Over budget");
  }
  if (kind === "extra") fit -= 20;

  const promoMatch = hay.match(/\bbogo\b|buy \d+,? get \d+(?: free)?|2 for 1|two for one|\d+% off/i);

  // Decision-1 estimate, when present, carries most of the weight over the keyword guess.
  let kindFinal: MenuOption["kind"] = kind;
  if (est) {
    health = est.score * 0.7 + health * 0.3;
    kindFinal = est.kind === "main" || est.kind === "combo_or_bundle" ? "main" : est.kind === "side" ? "side" : "extra";
    if (est.method === "fried_battered" && !cautions.includes("Fried or battered")) cautions.unshift("Fried or battered");
    if (est.vegetables === "half_plate_or_more" && !reasons.includes("Vegetable-forward")) reasons.unshift("Vegetable-forward");
    if (est.highSodium > 0.6) cautions.push("Likely high sodium");
    if (est.highSugar > 0.6) cautions.push("Likely high sugar");
  }
  const calories = input.calories ?? (est ? est.caloriesEst : null);
  if (intent.maxCalories !== null && calories !== null && calories > intent.maxCalories) {
    fit -= 30;
    cautions.push(`${input.calories ? "" : "~"}${calories} kcal, over your limit`);
  }
  if (input.calories && input.calories > 1100) health -= 8;

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    healthScore: clamp(health),
    fitScore: clamp(fit),
    portionScore: clamp(portion),
    kind: kindFinal,
    reasons: [...new Set(reasons)].slice(0, 3),
    cautions: [...new Set(cautions)].slice(0, 3),
    promo: promoMatch ? promoMatch[0] : null,
    calories,
    caloriesEstimated: !input.calories && Boolean(est),
    health: est ? slimHealth(est) : null,
    blocked,
  };
}

/* ------------------------------- combos ----------------------------------- */

const FEE_RATE = 0.13; // HST on food
const SERVICE_FEE = 2.99;

export function buildCombo(options: MenuOption[], intent: MealIntent, deals: Deal[] = []): ComboPlan {
  // No stated budget: build a sane plate for the party (about $25 a head) instead of stacking everything.
  const budget = intent.budgetCad ?? Math.max(1, intent.servings) * 25;
  const hasBogo = deals.some((d) => d.kind === "bogo");
  const priced = options.filter((o) => o.priceCad !== null && o.kind !== "extra");
  const rank = (o: MenuOption) => o.healthScore * 0.6 + o.fitScore * 0.4;
  // Bundles sized for far more people than asked for do not belong in a plate.
  const mains = priced.filter((o) => o.kind === "main" && !(/\b(for|serves)\s+(ten|eight|six|five|four|\d{1,2})\b/i.test(o.name) && !new RegExp(`\\b(for|serves)\\s+(${intent.servings}|two|three)\\b`, "i").test(o.name))).sort((a, b) => rank(b) - rank(a));
  const sides = priced.filter((o) => o.kind === "side").sort((a, b) => rank(b) - rank(a));

  const items: MenuOption[] = [];
  let subtotal = 0;
  // Budget check uses the net after the deal, before adding tax and fees on top.
  const netWith = (extra: MenuOption) => {
    const next = [...items, extra];
    const sub = subtotal + extra.priceCad!;
    return sub - dealDiscount(next, sub, deals).discount;
  };
  const fits = (extra: MenuOption) => budget === null || netWith(extra) * (1 + FEE_RATE) + SERVICE_FEE <= budget;

  // With BOGO the second main is free, so always aim for a pair.
  const wantMains = Math.max(hasBogo ? 2 : 1, Math.min(intent.servings * (hasBogo ? 2 : 1), 4));
  for (const m of mains) {
    if (items.filter((i) => i.kind === "main").length >= wantMains) break;
    if (fits(m)) { items.push(m); subtotal += m.priceCad!; }
  }
  // Big appetite: add a second main or sides while the budget allows.
  if (intent.wantsLargePortions > 0.6 && budget !== null) {
    for (const extra of [...mains.filter((m) => !items.includes(m)).slice(0, 1), ...sides]) {
      if (items.length >= 4) break;
      if (fits(extra)) { items.push(extra); subtotal += extra.priceCad!; }
    }
  } else if (sides[0] && fits(sides[0])) {
    items.push(sides[0]);
    subtotal += sides[0].priceCad!;
  }

  const { discount, label } = dealDiscount(items, subtotal, deals);
  const net = Math.max(0, subtotal - discount);
  const fees = items.length ? net * FEE_RATE + SERVICE_FEE : 0;
  const total = net + fees;
  return {
    items: items.map(({ id, name, priceCad, kind }) => ({ id, name, priceCad, kind })),
    subtotalCad: Number(subtotal.toFixed(2)),
    discountCad: Number(discount.toFixed(2)),
    dealLabel: discount > 0 ? label : null,
    netCad: Number(net.toFixed(2)),
    estimatedFeesCad: Number(fees.toFixed(2)),
    estimatedTotalCad: Number(total.toFixed(2)),
    budgetCad: intent.budgetCad,
    fitsBudget: intent.budgetCad === null ? true : total <= intent.budgetCad && items.length > 0,
  };
}

function groupFromRaw(raw: RawRestaurant, intent: MealIntent, source: MenuSource): RestaurantGroup {
  const unique = raw.items.filter((it, i, arr) => arr.findIndex((o) => o.name.toLowerCase() === it.name.toLowerCase() && o.price === it.price) === i);
  const options: MenuOption[] = unique.flatMap((it, i) => {
    const { blocked, ...scored } = scoreOption({ name: it.name, description: it.description, priceCad: it.price, health: it.health, calories: it.calories }, intent);
    if (blocked) return [];
    const id = `${slug(raw.name)}-${slug(it.name)}-${i}`;
    // Estimated nutrition goes through the same engine and biomarker lens as the verified catalogue.
    const synthetic = it.health?.nutrients ? toSyntheticDish(it.health, { id, name: it.name, restaurant: raw.name, description: it.description, priceCad: it.price, publishedCalories: it.calories }) : null;
    const evaluated = synthetic
      ? evaluateDish(synthetic, {
          activeLens: intent.primaryLens,
          excludedAllergens: intent.detectedAllergens,
          excludedIngredients: intent.detectedIngredientExclusions,
          decisionWeights: intent.noulWeights,
        })
      : undefined;
    // When the estimate is anchored to published calories the nutrients are rescaled; the component masses must follow.
    const scale = it.health && synthetic && it.health.nutrients.calories > 0 ? synthetic.nutrients.calories / it.health.nutrients.calories : 1;
    const indices = it.health && synthetic
      ? computeIndices(compositionFromComponents(it.health.components.map((c) => ({ ...c, grams: c.grams * scale })), synthetic.nutrients, it.health.kind))
      : null;
    if (evaluated) {
      scored.healthScore = Math.round(evaluated.combinedRankScore * 0.8 + scored.healthScore * 0.2);
      scored.reasons = [...new Set([...evaluated.takeMoreOfHits.slice(0, 2).map((h) => h.nutrientOrFood), ...scored.reasons])].slice(0, 3);
      scored.cautions = [...new Set([...evaluated.takeLessOfChecks.filter((c) => c.status === "caution").slice(0, 2).map((c) => c.nutrientOrFood), ...scored.cautions])].slice(0, 3);
    }
    return [{
      evaluated: evaluated ? slimEvaluation(evaluated) : undefined,
      indices,
      id,
      name: it.name,
      description: it.description,
      priceCad: it.price,
      restaurant: raw.name,
      section: it.section,
      imageUrl: it.imageUrl,
      url: it.url ?? raw.url ?? uberEatsSearchUrl(`${raw.name} ${it.name}`),
      source,
      ...scored,
    }];
  });
  const capped = intent.maxCalories !== null ? options.filter((o) => o.calories === null || o.calories <= intent.maxCalories!) : options;
  return { ...finalizeGroup(raw.name, raw.url, raw.rating, raw.etaText, source, capped, intent, raw.promos ?? []), geo: raw.geo ?? null };
}

function finalizeGroup(
  restaurant: string,
  storeUrl: string | null,
  rating: number | null,
  etaText: string | null,
  source: MenuSource,
  options: MenuOption[],
  intent: MealIntent,
  promos: string[] = []
): RestaurantGroup {
  const esc = (v: string) => v.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const dishRe = intent.dishWord ? dishPattern(intent.dishWord) : null;
  const cuisineRe = intent.cuisineHint ? new RegExp(esc(intent.cuisineHint), "i") : null;
  // Health leads (60 %); fit (protein, portion, deal) breaks ties. Items under 45 health never lift a restaurant.
  // When the user named a dish, mains that are that dish lead the card ahead of anything healthier that is not.
  // A cuisine word ("mexican") does not get this: it would put "Mexican Coke" ahead of the burrito bowl.
  const named = Boolean(dishRe && intent.dishWord && isDish(intent.dishWord));
  const servesIt = (o: MenuOption) => Boolean(dishRe && dishRe.test(o.name));
  const value = (o: MenuOption) => o.healthScore * 0.6 + o.fitScore * 0.4 + (o.promo ? 5 : 0) + (named && o.kind === "main" && servesIt(o) ? 30 : 0);
  const sorted = [...options].sort((a, b) => value(b) - value(a));
  const combo = buildCombo(sorted, intent, parseDeals(promos));
  const top = sorted.filter((o) => o.kind === "main").slice(0, 3);
  const base = top.length ? top.reduce((s, o) => s + value(o), 0) / top.length : 0;
  const bestHealth = top[0]?.healthScore ?? 0;
  const unhealthyPenalty = bestHealth < 45 ? 40 : bestHealth < 55 ? 15 : 0;
  const nameHit = intent.restaurantHint && slug(restaurant).includes(slug(intent.restaurantHint).split("-")[0]) ? 25 : 0;
  const restaurantText = `${restaurant} ${options.slice(0, 20).map((o) => `${o.name} ${o.description}`).join(" ")}`;
  // A named dish or cuisine is what the user came for: big bonus when the restaurant serves it (the dish must be in
  // an item name or the restaurant name, not just a description), and a miss costs more than any health lead can
  // recover, so a "burger" search never opens with quinoa bowls.
  const servesDish = Boolean(dishRe && (dishRe.test(restaurant) || (named ? options.some(servesIt) : dishRe.test(restaurantText))));
  const cuisineHit = servesDish || (cuisineRe && cuisineRe.test(restaurantText)) ? 25 : intent.dishWord || intent.cuisineHint ? -40 : 0;
  const valueHit = intent.valueFocus > 0.6 && combo.items.length ? Math.max(-10, Math.min(12, (38 - combo.netCad) * 0.5)) : 0;
  const tasteHit = intent.tasteConfidence >= 0.5 && TASTE_WORDS[intent.tasteProfile].test(restaurant) ? 6 : 0;
  const halalMiss = intent.diet === "halal" && !/\bhalal\b/i.test(restaurantText) ? 60 : 0;
  return {
    restaurant,
    storeUrl: storeUrl ?? uberEatsSearchUrl(restaurant),
    doorDashUrl: doorDashSearchUrl(restaurant),
    rating,
    etaText,
    source,
    promos,
    geo: null,
    distanceKm: null,
    otherLocations: [],
    options: sorted.slice(0, 5),
    combo,
    rankScore: Math.round(base + nameHit + cuisineHit + tasteHit + valueHit - unhealthyPenalty - halalMiss + (combo.fitsBudget ? 10 : -20) + (promos.length || sorted.some((o) => o.promo) ? 5 : 0) - (top.length === 0 ? 50 : 0)),
  };
}

function searchCatalogue(intent: MealIntent): RestaurantGroup[] {
  const byRestaurant = new Map<string, MenuOption[]>();
  for (const dish of GTA_DISH_CATALOGUE) {
    const evaluated = evaluateDish(dish, {
      activeLens: intent.primaryLens,
      excludedAllergens: intent.detectedAllergens,
      excludedIngredients: intent.detectedIngredientExclusions,
      decisionWeights: intent.noulWeights,
    });
    if (evaluated.matchState.type === "excluded_allergen") continue;
    const { blocked, ...scored } = scoreOption({ name: dish.name, description: dish.description, priceCad: dish.priceCad }, intent);
    if (blocked) continue;
    const option: MenuOption = {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      priceCad: dish.priceCad,
      restaurant: dish.restaurant,
      section: dish.category,
      imageUrl: null,
      url: uberEatsSearchUrl(`${dish.restaurant} ${dish.name.split("+")[0].trim()}`),
      source: "catalogue",
      ...scored,
      healthScore: evaluated.combinedRankScore,
      kind: "main",
      reasons: [
        ...evaluated.takeMoreOfHits.slice(0, 2).map((h) => h.nutrientOrFood),
        `${dish.nutrients.proteinG}g protein · ${dish.nutrients.fibreG}g fibre`,
      ],
      cautions: evaluated.takeLessOfChecks.filter((c) => c.status === "caution").slice(0, 2).map((c) => c.nutrientOrFood),
      promo: null,
      calories: dish.nutrients.calories,
      caloriesEstimated: false,
      health: null,
      evaluated: slimEvaluation(evaluated),
      indices: computeIndices(compositionFromDish(dish)),
    };
    if (intent.maxCalories !== null && dish.nutrients.calories > intent.maxCalories) continue;
    byRestaurant.set(dish.restaurant, [...(byRestaurant.get(dish.restaurant) ?? []), option]);
  }
  return [...byRestaurant.entries()].map(([restaurant, options]) => {
    const dd = GTA_DISH_CATALOGUE.find((d) => d.restaurant === restaurant)?.locations[0]?.doorDashUrl ?? null;
    const g = finalizeGroup(restaurant, uberEatsSearchUrl(restaurant), null, null, "catalogue", options, intent);
    return { ...g, doorDashUrl: dd ?? g.doorDashUrl };
  });
}

/* --------------------------------- search --------------------------------- */

function datasetTerms(intent: MealIntent): string[] {
  const terms = [
    ...intent.searchTerm.split(/\s+/),
    intent.protein !== "any" ? (intent.protein === "plant" ? "tofu" : intent.protein) : "",
    intent.cuisineHint ?? "",
    intent.dishWord ?? "",
    ...intent.wantedIngredients,
    intent.diet === "halal" ? "halal" : intent.diet === "vegan" ? "vegan" : intent.diet === "vegetarian" ? "vegetarian" : intent.diet === "gluten_free" ? "gluten" : "",
    ...intent.queryText.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !/^(healthy|enough|portions?|something|please|around|under|budget|dollars?|would|about|really|people|with|that|this|like|want|need|some|more|less|have|food|meal|lunch|dinner|night|date|cheap|good|nice|best)$/.test(w)),
  ].filter(Boolean);
  return [...new Set(terms)].slice(0, 12);
}

/** The dataset ships with the build and is searched in-process. */
async function datasetMatches(intent: MealIntent, opts: SearchOptions): Promise<RawRestaurant[]> {
  try {
    const rs = await searchLocalDataset({ terms: datasetTerms(intent), hint: intent.restaurantHint, origin: opts.origin, rangeKm: opts.rangeKm, limit: 30, itemsPerRestaurant: 60 });
    return normalizeRestaurants(rs);
  } catch (e) {
    console.warn("[dataset] local snapshot unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** "BOGO only" means a real buy-one-get-one (or 2-for-1) at the store or on an item. */
const hasDeal = (g: RestaurantGroup) => parseDeals(g.promos).some((d) => d.kind === "bogo") || g.options.some((o) => o.promo && /bogo|buy \d+,? get \d+|2 for 1|two for one/i.test(o.promo));

/** "Monkey Poke Rosedale (Unit 1 …)" and "Monkey Poke Queen West" are one brand; keep one card per brand. */
function brandKey(name: string): string {
  const words = name.split("(")[0].toLowerCase().replace(/[^a-z0-9'\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words.slice(0, 2) : words).join(" ");
}

function collapseBrands(groups: RestaurantGroup[]): RestaurantGroup[] {
  const byBrand = new Map<string, RestaurantGroup>();
  for (const g of groups) {
    const key = brandKey(g.restaurant);
    const kept = byBrand.get(key);
    if (!kept) {
      byBrand.set(key, { ...g, otherLocations: [] });
      continue;
    }
    // Prefer a clearly nearer location when it scores about as well.
    const nearer = g.distanceKm !== null && (kept.distanceKm === null || g.distanceKm < kept.distanceKm - 2) && g.rankScore >= kept.rankScore - 8;
    if (nearer) {
      byBrand.set(key, { ...g, otherLocations: [...kept.otherLocations, { restaurant: kept.restaurant, distanceKm: kept.distanceKm, storeUrl: kept.storeUrl }] });
    } else {
      kept.otherLocations.push({ restaurant: g.restaurant, distanceKm: g.distanceKm, storeUrl: g.storeUrl });
    }
  }
  return [...byBrand.values()].sort((a, b) => b.rankScore - a.rankScore);
}

const closeness = (score: number, target: number, sigma = 12) => Math.exp(-((score - target) ** 2) / (2 * sigma * sigma));

function applyDeals(groups: RestaurantGroup[], opts: SearchOptions): RestaurantGroup[] {
  let out = groups;
  if (opts.targetScore !== undefined) {
    const t = opts.targetScore;
    out = out
      .map((g) => {
        const options = [...g.options].sort((a, b) => closeness(b.healthScore, t) * 100 + b.fitScore * 0.3 - (closeness(a.healthScore, t) * 100 + a.fitScore * 0.3));
        const best = options[0];
        return { ...g, options, rankScore: best ? Math.round(closeness(best.healthScore, t) * 100 + best.fitScore * 0.3 + (g.combo.fitsBudget ? 5 : -20)) : 0 };
      })
      .sort((a, b) => b.rankScore - a.rankScore);
  }
  if (opts.origin) {
    const origin = opts.origin;
    out = out
      .map((g) => ({ ...g, distanceKm: g.geo ? Number(distanceKm(origin, g.geo).toFixed(1)) : null }))
      .filter((g) => opts.rangeKm === undefined || g.distanceKm === null || g.distanceKm <= opts.rangeKm);
  }
  out = collapseBrands(out);
  if (!opts.dealsOnly) return out;
  return out.filter(hasDeal).map((g) => ({ ...g, options: g.options.some((o) => o.promo) ? [...g.options].sort((a, b) => Number(Boolean(b.promo)) - Number(Boolean(a.promo))) : g.options }));
}

export async function searchMenus(intent: MealIntent, address: string, opts: SearchOptions = {}): Promise<MenuSearchResult> {
  const attempts: ProviderAttempt[] = [];
  const live: RestaurantGroup[] = [];
  const seenRestaurant = new Set<string>();
  const pushGroups = (raw: RawRestaurant[], source: MenuSource) => {
    for (const r of raw) {
      const k = slug(r.name);
      if (seenRestaurant.has(k)) continue;
      seenRestaurant.add(k);
      live.push(groupFromRaw(r, intent, source));
    }
  };

  // 1. Dataset matches.
  const fromDataset = await datasetMatches(intent, opts);
  if (fromDataset.length > 0) {
    pushGroups(fromDataset, "dataset");
    attempts.push({ provider: "dataset", status: "used", detail: `${live.length} restaurants from the dataset`, restaurants: live.length });
  }

  if (live.length > 0) {
    live.sort((a, b) => b.rankScore - a.rankScore);
    const catalogue = searchCatalogue(intent).sort((a, b) => b.rankScore - a.rankScore);
    attempts.push({ provider: "catalogue", status: "used", detail: `${catalogue.length} GTA restaurants with verified nutrition`, restaurants: catalogue.length });
    return { source: live[0].source, groups: applyDeals([...live, ...catalogue], opts), attempts };
  }

  const groups = searchCatalogue(intent).sort((a, b) => b.rankScore - a.rankScore);
  attempts.push({ provider: "catalogue", status: "used", detail: `${groups.length} GTA restaurants with verified nutrition`, restaurants: groups.length });
  return { source: "catalogue", groups: applyDeals(groups, opts), attempts };
}
