export type DishCategory = "bowls" | "salads" | "plates" | "wraps" | "soups" | "smoothies";

export type GtaNeighborhood =
  | "all"
  | "Downtown & Financial District"
  | "King West & Liberty Village"
  | "Yorkville & Midtown"
  | "Queen West & Ossington"
  | "Etobicoke & Bloor West"
  | "North York"
  | "Mississauga (Square One)"
  | "Scarborough";

export type BiomarkerLensId =
  | "general_healthy"
  | "bilirubin_elevated"
  | "iron_high"
  | "iron_low"
  | "fatty_liver_masld"
  | "sodium_bp"
  | "glycemic_steady";

export type AllergenTag =
  | "peanuts"
  | "tree_nuts"
  | "sesame"
  | "gluten"
  | "dairy"
  | "soy"
  | "egg"
  | "shellfish"
  | "fish";

export interface ScientificStudy {
  id: string;
  shortTitle: string;
  citation: string;
  finding: string;
  url: string;
  relevance: "baseline_score" | "bilirubin" | "iron" | "hepatic_metabolic" | "sodium_cardio";
}

export interface NutrientProfile {
  calories: number;
  proteinG: number;
  carbsG: number;
  fibreG: number;
  sugarsG: number;
  fatG: number;
  saturatedFatG: number;
  transFatG: number;
  sodiumMg: number;
  ironMg: number | null;
  vitaminCMg: number | null;
  potassiumMg: number | null;
}

export interface BioactiveSignals {
  hasCruciferous: boolean; // broccoli, kale, cabbage, bok choy -> induces UGT1A1 bilirubin conjugation
  hasSolubleFibreSource: boolean; // oats, beans, lentils, avocado, sweet potato, chia -> binds gut bilirubin & lipids
  hasIntactWholeGrains: boolean; // brown rice, quinoa, farro -> steady glucose & bilirubin protection
  hasHemeIronRedMeat: boolean; // beef, steak, lamb -> high absorption heme iron
  hasPolyphenolChelate: boolean; // greens, legumes, herbs, seeds -> moderates non-heme iron uptake
  hasOmega3OrMonoFat: boolean; // salmon, avocado, olive oil, walnuts
  isLowCalorieFastingRisk: boolean; // < 320 kcal -> fasting/hypocaloric state can spike unconjugated bilirubin
}

export interface GtaLocation {
  neighborhood: Exclude<GtaNeighborhood, "all">;
  address: string;
  city: string;
  postalCode: string;
  googleMapsUrl: string;
  doorDashUrl: string;
  directOrderUrl: string;
}

export interface GtaDish {
  id: string;
  name: string;
  restaurant: string;
  brandSlug: string;
  category: DishCategory;
  servingSize: string;
  priceCad: number;
  description: string;
  ingredients: string[];
  allergens: AllergenTag[];
  nutrients: NutrientProfile;
  bioactives: BioactiveSignals;
  locations: GtaLocation[];
  nutritionSourceTitle: string;
  nutritionSourceUrl: string;
  nutritionVerifiedDate: string;
}

export interface ScoreComponent {
  id: string;
  label: string;
  direction: "positive" | "negative";
  points: number;
  maxPoints: number;
  metricDisplay: string;
  explanation: string;
  studyId: string;
}

export interface BidirectionalAdjustment {
  direction: "more" | "less";
  nutrientOrFood: string;
  targetDisplay: string;
  dishValueDisplay: string;
  status: "optimal" | "acceptable" | "caution";
  impactPoints: number;
  rationale: string;
  studyCitation: string;
}

export type DishMatchState =
  | { type: "matches"; summary: string }
  | { type: "caution"; reasons: string[] }
  | { type: "excluded_allergen"; blockedBy: string[] }
  | { type: "missing_data"; missingFields: string[] };

export interface EvaluatedDish {
  dish: GtaDish;
  baselineScore: number; // 0 - 100
  baselineGrade: "A+" | "A" | "B+" | "B" | "C" | "D";
  baselineComponents: ScoreComponent[];
  biomarkerFitScore: number; // 0 - 100 personalized to active lenses + Decision-1 weights
  combinedRankScore: number; // 0 - 100 weighted blend
  takeMoreOfHits: BidirectionalAdjustment[];
  takeLessOfChecks: BidirectionalAdjustment[];
  matchState: DishMatchState;
}

export interface BiomarkerLensSpec {
  id: BiomarkerLensId;
  name: string;
  shortBadge: string;
  subtitle: string;
  biomarkerFocus: string;
  takeMoreOf: {
    label: string;
    target: string;
    why: string;
    studyId: string;
  }[];
  takeLessOf: {
    label: string;
    limit: string;
    why: string;
    studyId: string;
  }[];
  defaultNumericTargets: {
    minFibreG?: number;
    minProteinG?: number;
    maxSodiumMg?: number;
    maxSaturatedFatG?: number;
    maxSugarsG?: number;
    minCalories?: number;
    maxIronMg?: number;
    minIronMg?: number;
  };
}

export interface DecisionApiNoulWeights {
  boost_soluble_fibre: number;
  boost_cruciferous_ugt1a1: number;
  boost_steady_complex_carbs: number;
  boost_bioavailable_iron_vitc: number;
  boost_non_heme_plant_protein: number;
  boost_potassium_produce: number;
  limit_saturated_fat: number;
  limit_refined_sugars: number;
  limit_heme_red_meat: number;
  limit_high_sodium: number;
}

export interface RoutedDishOption {
  dishId: string;
  dishName: string;
  restaurant: string;
  priceCad: number;
  matchProbability: number;
  whyItFitsTasteAndBiomarker: string;
  baselineScore: number;
  biomarkerFitScore: number;
}

export interface DecisionApiAnalysisResult {
  queryText: string;
  model: string;
  latencyMs: number;
  primaryLens: BiomarkerLensId;
  primaryConfidence: number;
  lensProbabilities: Record<string, number>;
  ironDirection: "reduce_iron_overload" | "boost_iron_deficiency" | "neutral_iron";
  ironDirectionConfidence: number;
  tasteProfile?: string;
  tasteConfidence?: number;
  tasteProbabilities?: Record<string, number>;
  routedDishes?: RoutedDishOption[];
  noulWeights: DecisionApiNoulWeights;
  detectedAllergens: AllergenTag[];
  detectedIngredientExclusions: string[];
  recommendedTakeMore: string[];
  recommendedTakeLess: string[];
  suggestedFilters: {
    minFibreG: number;
    minProteinG: number;
    maxSodiumMg: number;
    maxSaturatedFatG: number;
    maxSugarsG: number;
  };
}
