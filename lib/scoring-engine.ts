import type {
  AllergenTag,
  BidirectionalAdjustment,
  BiomarkerLensId,
  DecisionApiNoulWeights,
  DishCategory,
  DishMatchState,
  EvaluatedDish,
  GtaDish,
  GtaNeighborhood,
  ScoreComponent,
} from "./models";
import { SCIENTIFIC_STUDIES } from "./studies-and-lenses";

export interface DishFilterCriteria {
  searchQuery?: string;
  neighborhood?: GtaNeighborhood;
  category?: DishCategory | "all";
  activeLens: BiomarkerLensId;
  secondaryLens?: BiomarkerLensId | null;
  excludedAllergens: AllergenTag[];
  excludedIngredients: string[];
  minFibreG?: number;
  minProteinG?: number;
  maxSodiumMg?: number;
  maxSaturatedFatG?: number;
  maxSugarsG?: number;
  decisionWeights?: DecisionApiNoulWeights | null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeBaselineHealthScore(dish: GtaDish): {
  score: number;
  grade: EvaluatedDish["baselineGrade"];
  components: ScoreComponent[];
} {
  const n = dish.nutrients;
  const b = dish.bioactives;

  // 1. Protein Density & Quality (0 to +18 pts)
  const proteinPer100Kcal = n.calories > 0 ? (n.proteinG / n.calories) * 100 : 0;
  const rawProteinPts = clamp((n.proteinG / 38) * 11 + (proteinPer100Kcal / 6.5) * 7, 0, 18);
  const proteinPts = Math.round(rawProteinPts * 10) / 10;

  // 2. Dietary Fibre Load (0 to +17 pts)
  const rawFibrePts = clamp((n.fibreG / 13) * 14 + (b.hasSolubleFibreSource ? 3 : 0), 0, 17);
  const fibrePts = Math.round(rawFibrePts * 10) / 10;

  // 3. Whole-Food Plant & Bioactive Diversity (0 to +15 pts)
  let bioactiveRaw = 0;
  if (b.hasCruciferous) bioactiveRaw += 4.5;
  if (b.hasIntactWholeGrains) bioactiveRaw += 4.0;
  if (b.hasPolyphenolChelate) bioactiveRaw += 3.5;
  if (b.hasOmega3OrMonoFat) bioactiveRaw += 3.0;
  const bioactivePts = Math.round(clamp(bioactiveRaw, 0, 15) * 10) / 10;

  // 4. Sodium Load Penalty (0 to -18 pts) — Health Canada FOP threshold ~650mg ideal per meal
  let sodiumPenalty = 0;
  if (n.sodiumMg > 550) {
    sodiumPenalty = -clamp(((n.sodiumMg - 550) / 650) * 18, 0, 18);
  }
  sodiumPenalty = Math.round(sodiumPenalty * 10) / 10;

  // 5. Saturated & Trans Fat Penalty (0 to -16 pts)
  let satFatPenalty = 0;
  if (n.saturatedFatG > 3.5) {
    satFatPenalty = -clamp(((n.saturatedFatG - 3.5) / 5.5) * 13, 0, 13);
  }
  if (n.transFatG > 0) {
    satFatPenalty -= 3;
  }
  satFatPenalty = Math.round(clamp(satFatPenalty, -16, 0) * 10) / 10;

  // 6. Sugars & Caloric Imbalance Penalty (0 to -16 pts)
  let sugarPenalty = 0;
  const sugarThreshold = dish.category === "smoothies" ? 18 : 9;
  if (n.sugarsG > sugarThreshold) {
    sugarPenalty = -clamp(((n.sugarsG - sugarThreshold) / 16) * 14, 0, 14);
  }
  if (n.calories > 820) {
    sugarPenalty -= 2;
  }
  sugarPenalty = Math.round(clamp(sugarPenalty, -16, 0) * 10) / 10;

  const totalRaw = 50 + proteinPts + fibrePts + bioactivePts + sodiumPenalty + satFatPenalty + sugarPenalty;
  const score = Math.round(clamp(totalRaw, 12, 99));

  let grade: EvaluatedDish["baselineGrade"] = "C";
  if (score >= 90) grade = "A+";
  else if (score >= 82) grade = "A";
  else if (score >= 74) grade = "B+";
  else if (score >= 65) grade = "B";
  else if (score >= 52) grade = "C";
  else grade = "D";

  const components: ScoreComponent[] = [
    {
      id: "protein_density",
      label: "Protein Density & Satiety",
      direction: "positive",
      points: proteinPts,
      maxPoints: 18,
      metricDisplay: `${n.proteinG}g (${proteinPer100Kcal.toFixed(1)}g/100kcal)`,
      explanation: "Rewards complete protein ≥25–38g and high protein-to-calorie density.",
      studyId: "nutriscore_fsa",
    },
    {
      id: "dietary_fibre",
      label: "Dietary & Soluble Fibre",
      direction: "positive",
      points: fibrePts,
      maxPoints: 17,
      metricDisplay: `${n.fibreG}g fibre`,
      explanation: "Rewards ≥8–13g dietary fibre and soluble gut-binding sources (legumes, oats, avocado).",
      studyId: "harvard_ahei",
    },
    {
      id: "whole_food_bioactives",
      label: "Whole-Food Bioactive Diversity",
      direction: "positive",
      points: bioactivePts,
      maxPoints: 15,
      metricDisplay: [
        b.hasCruciferous ? "Cruciferous" : null,
        b.hasIntactWholeGrains ? "Whole Grain" : null,
        b.hasOmega3OrMonoFat ? "Healthy Fats" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Basic ingredients",
      explanation: "AHEI-2010 bonus for cruciferous greens, intact whole grains, polyphenols, and unsaturated fats.",
      studyId: "harvard_ahei",
    },
    {
      id: "sodium_load",
      label: "Sodium Load Control",
      direction: "negative",
      points: sodiumPenalty,
      maxPoints: 18,
      metricDisplay: `${n.sodiumMg} mg Na`,
      explanation:
        n.sodiumMg <= 550
          ? "Zero penalty: well below Health Canada's per-meal sodium warning threshold."
          : `Deduction for sodium above 550mg baseline (${Math.round((n.sodiumMg / 2300) * 100)}% daily limit).`,
      studyId: "health_canada_fop",
    },
    {
      id: "saturated_fat",
      label: "Saturated & Trans Fat Load",
      direction: "negative",
      points: satFatPenalty,
      maxPoints: 16,
      metricDisplay: `${n.saturatedFatG}g sat fat`,
      explanation:
        n.saturatedFatG <= 3.5
          ? "Zero penalty: low saturated fat supports hepatic & vascular lipid clearance."
          : "Deduction for saturated fat exceeding 3.5g per meal.",
      studyId: "health_canada_fop",
    },
    {
      id: "sugar_caloric",
      label: "Free Sugar & Glycemic Load",
      direction: "negative",
      points: sugarPenalty,
      maxPoints: 16,
      metricDisplay: `${n.sugarsG}g sugars · ${n.calories} kcal`,
      explanation:
        sugarPenalty === 0
          ? "Zero penalty: minimal added/free sugars and balanced meal energy."
          : "Deduction for elevated sugars in dressings, sauces, or fruit base.",
      studyId: "harvard_ahei",
    },
  ];

  return { score, grade, components };
}

export function evaluateBiomarkerFit(
  dish: GtaDish,
  lens: BiomarkerLensId,
  secondaryLens: BiomarkerLensId | null | undefined,
  weights: DecisionApiNoulWeights | null | undefined
): {
  fitScore: number;
  takeMoreOfHits: BidirectionalAdjustment[];
  takeLessOfChecks: BidirectionalAdjustment[];
} {
  const n = dish.nutrients;
  const b = dish.bioactives;
  const takeMoreOfHits: BidirectionalAdjustment[] = [];
  const takeLessOfChecks: BidirectionalAdjustment[] = [];

  const activeLenses = new Set<BiomarkerLensId>([lens]);
  if (secondaryLens && secondaryLens !== "general_healthy") {
    activeLenses.add(secondaryLens);
  }

  let rawFit = 70; // Neutral starting fit

  // --- BILIRUBIN / GILBERT'S SYNDROME LENS ---
  if (activeLenses.has("bilirubin_elevated") || (weights && weights.boost_cruciferous_ugt1a1 >= 0.65)) {
    const cruciferousWeight = weights ? Math.max(0.8, weights.boost_cruciferous_ugt1a1) : 1.0;
    // 1. MORE: Cruciferous vegetables (UGT1A1 induction)
    if (b.hasCruciferous) {
      const pts = Math.round(12 * cruciferousWeight);
      rawFit += pts;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Cruciferous Vegetables (UGT1A1 Induction)",
        targetDisplay: "Kale, broccoli, or cabbage present",
        dishValueDisplay: "Included (Brassica greens)",
        status: "optimal",
        impactPoints: pts,
        rationale: "Sulforaphane & glucosinolates upregulate UGT1A1 bilirubin conjugation enzymes.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_cruciferous_ugt1a1.citation,
      });
    } else {
      rawFit -= 6;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Cruciferous Vegetables (UGT1A1 Induction)",
        targetDisplay: "Kale, broccoli, or cabbage",
        dishValueDisplay: "None detected",
        status: "caution",
        impactPoints: -6,
        rationale: "Missing Brassica vegetables that actively induce UGT1A1 bilirubin clearance.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_cruciferous_ugt1a1.citation,
      });
    }

    // 2. MORE: Soluble & Total Fibre >= 8g (Gut Bilirubin Binding)
    if (n.fibreG >= 9 && b.hasSolubleFibreSource) {
      rawFit += 11;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Gut-Binding Dietary Fibre",
        targetDisplay: "≥8g fibre + soluble source",
        dishValueDisplay: `${n.fibreG}g fibre`,
        status: "optimal",
        impactPoints: 11,
        rationale: "High soluble/insoluble fibre binds bilirubin in the gut lumen to prevent enterohepatic reabsorption.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_fibre_binding.citation,
      });
    } else if (n.fibreG >= 7) {
      rawFit += 5;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Gut-Binding Dietary Fibre",
        targetDisplay: "≥8g fibre",
        dishValueDisplay: `${n.fibreG}g fibre`,
        status: "acceptable",
        impactPoints: 5,
        rationale: "Moderate fibre assists intestinal bilirubin transit.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_fibre_binding.citation,
      });
    } else {
      rawFit -= 7;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Gut-Binding Dietary Fibre",
        targetDisplay: "≥8g fibre",
        dishValueDisplay: `${n.fibreG}g fibre`,
        status: "caution",
        impactPoints: -7,
        rationale: "Low fibre allows higher intestinal reabsorption of unconjugated bilirubin.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_fibre_binding.citation,
      });
    }

    // 3. MORE: Steady Complex Carbs & Caloric Floor (Prevents Fasting Bilirubin Spike)
    if (!b.isLowCalorieFastingRisk && n.carbsG >= 38 && b.hasIntactWholeGrains) {
      rawFit += 8;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Steady Complex Carbs & Caloric Cushion",
        targetDisplay: "≥400 kcal & intact whole grains",
        dishValueDisplay: `${n.calories} kcal · ${n.carbsG}g carbs`,
        status: "optimal",
        impactPoints: 8,
        rationale: "Prevents hypocaloric/fasting-induced spikes in unconjugated serum bilirubin.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_fasting_caloric.citation,
      });
    } else if (b.isLowCalorieFastingRisk) {
      rawFit -= 12;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Adequate Meal Energy (Anti-Fasting Guard)",
        targetDisplay: "≥400 kcal per meal",
        dishValueDisplay: `${n.calories} kcal (Too low alone)`,
        status: "caution",
        impactPoints: -12,
        rationale: "Very low-calorie meals (<320 kcal) mimic fasting and can spike unconjugated bilirubin in Gilbert's syndrome.",
        studyCitation: SCIENTIFIC_STUDIES.bilirubin_fasting_caloric.citation,
      });
    }

    // 4. LESS: Saturated Fat <= 5.0g
    if (n.saturatedFatG <= 4.0) {
      rawFit += 7;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Saturated Fat & Biliary Lipid Load",
        targetDisplay: "≤5.0g sat fat",
        dishValueDisplay: `${n.saturatedFatG}g sat fat`,
        status: "optimal",
        impactPoints: 7,
        rationale: "Low saturated fat keeps hepatic lipid processing and bile flow unburdened.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    } else if (n.saturatedFatG <= 5.5) {
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Saturated Fat & Biliary Lipid Load",
        targetDisplay: "≤5.0g sat fat",
        dishValueDisplay: `${n.saturatedFatG}g sat fat`,
        status: "acceptable",
        impactPoints: 0,
        rationale: "Borderline saturated fat; keep rest of day's meals low in saturated lipids.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    } else {
      rawFit -= 12;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Saturated Fat & Biliary Lipid Load",
        targetDisplay: "≤5.0g sat fat",
        dishValueDisplay: `${n.saturatedFatG}g sat fat (High)`,
        status: "caution",
        impactPoints: -12,
        rationale: "Elevated saturated fat strains hepatic lipid metabolism.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    }

    // 5. LESS: Refined / Added Sugars <= 10g
    if (n.sugarsG <= 9) {
      rawFit += 6;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Sugars & Fructose Load",
        targetDisplay: "≤10g sugars",
        dishValueDisplay: `${n.sugarsG}g sugars`,
        status: "optimal",
        impactPoints: 6,
        rationale: "Minimal sugar avoids hepatic de novo lipogenesis.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    } else {
      const pen = n.sugarsG > 16 ? -14 : -7;
      rawFit += pen;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Sugars & Fructose Load",
        targetDisplay: "≤10g sugars",
        dishValueDisplay: `${n.sugarsG}g sugars`,
        status: "caution",
        impactPoints: pen,
        rationale: "Higher sugar load from sweet sauces or fruit base.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    }
  }

  // --- HIGH IRON / FERRITIN OVERLOAD LENS ---
  if (activeLenses.has("iron_high") || (weights && weights.limit_heme_red_meat >= 0.65)) {
    // 1. LESS: Heme Iron / Red Meat
    if (b.hasHemeIronRedMeat) {
      rawFit -= 28;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Heme Iron (Red Meat / Beef)",
        targetDisplay: "0g heme red meat",
        dishValueDisplay: `Contains red meat (${n.ironMg ?? "?"}mg Fe)`,
        status: "caution",
        impactPoints: -28,
        rationale: "Heme iron is absorbed at 15–35% regardless of ferritin stores; avoid when iron is elevated.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    } else {
      rawFit += 12;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Heme Iron (Red Meat / Beef)",
        targetDisplay: "0g heme red meat",
        dishValueDisplay: "Red-meat free",
        status: "optimal",
        impactPoints: 12,
        rationale: "Free of unregulated red-meat heme iron.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    }

    // 2. MORE: Polyphenol & Phytate Iron Chelators
    if (b.hasPolyphenolChelate) {
      rawFit += 10;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Natural Phytate & Polyphenol Chelators",
        targetDisplay: "Legumes, whole grains, or leafy greens",
        dishValueDisplay: "Included (inhibits excess Fe uptake)",
        status: "optimal",
        impactPoints: 10,
        rationale: "Phytates in whole grains/beans and polyphenols in greens reduce non-heme iron absorption by 40–60%.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    }
  }

  // --- LOW IRON / ANEMIA BUILDER LENS ---
  if (activeLenses.has("iron_low") || (weights && weights.boost_bioavailable_iron_vitc >= 0.65)) {
    const ironVal = n.ironMg ?? 0;
    const vitCVal = n.vitaminCMg ?? 0;

    if (ironVal >= 4.0) {
      const pts = b.hasHemeIronRedMeat ? 16 : 12;
      rawFit += pts;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Bioavailable Elemental Iron",
        targetDisplay: "≥3.5 mg iron/meal",
        dishValueDisplay: `${ironVal} mg Fe${b.hasHemeIronRedMeat ? " (Heme)" : " (Plant/Poultry)"}`,
        status: "optimal",
        impactPoints: pts,
        rationale: b.hasHemeIronRedMeat
          ? "High-absorption heme iron directly replenishes ferritin and hemoglobin."
          : "Strong iron density paired with whole-food co-factors.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    } else if (ironVal >= 3.2) {
      rawFit += 6;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Bioavailable Elemental Iron",
        targetDisplay: "≥3.5 mg iron/meal",
        dishValueDisplay: `${ironVal} mg Fe`,
        status: "acceptable",
        impactPoints: 6,
        rationale: "Moderate iron contribution toward daily repletion.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    } else {
      rawFit -= 12;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Bioavailable Elemental Iron",
        targetDisplay: "≥3.5 mg iron/meal",
        dishValueDisplay: `${ironVal} mg Fe (Low)`,
        status: "caution",
        impactPoints: -12,
        rationale: "Low iron density for someone actively rebuilding ferritin stores.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    }

    // MORE: Vitamin C Co-Factor (>= 35mg)
    if (vitCVal >= 45) {
      rawFit += 10;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Vitamin C Iron-Absorption Co-Factor",
        targetDisplay: "≥35 mg Vitamin C",
        dishValueDisplay: `${vitCVal} mg Vit C`,
        status: "optimal",
        impactPoints: 10,
        rationale: "Ascorbic acid reduces Fe³⁺ to Fe²⁺, multiplying non-heme iron absorption 3–4x.",
        studyCitation: SCIENTIFIC_STUDIES.iron_absorption_modulation.citation,
      });
    }
  }

  // --- HEPATIC LIPID / MASLD LENS ---
  if (activeLenses.has("fatty_liver_masld")) {
    if (b.hasOmega3OrMonoFat && n.saturatedFatG <= 4.5) {
      rawFit += 12;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Unsaturated / Omega-3 Lipid Profile",
        targetDisplay: "Olive oil, avocado, or wild salmon + ≤4.5g sat fat",
        dishValueDisplay: `${n.saturatedFatG}g sat / ${n.fatG}g total fat`,
        status: "optimal",
        impactPoints: 12,
        rationale: "Unsaturated fats support hepatic beta-oxidation and reduce liver fat accumulation.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    }
    if (n.proteinG >= 28) {
      rawFit += 9;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Hepatic Protein Target",
        targetDisplay: "≥26g lean/plant protein",
        dishValueDisplay: `${n.proteinG}g protein`,
        status: "optimal",
        impactPoints: 9,
        rationale: "High protein supports VLDL triglyceride export from the liver.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    }
    if (n.sugarsG > 8) {
      rawFit -= 12;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "Hepatic Fructose / Sugar Cap",
        targetDisplay: "≤8g sugars",
        dishValueDisplay: `${n.sugarsG}g sugars`,
        status: "caution",
        impactPoints: -12,
        rationale: "Excess sugars trigger hepatic de novo lipogenesis.",
        studyCitation: SCIENTIFIC_STUDIES.hepatic_masld_guidelines.citation,
      });
    }
  }

  // --- SODIUM & BLOOD PRESSURE LENS ---
  if (activeLenses.has("sodium_bp")) {
    if (n.sodiumMg <= 600) {
      rawFit += 16;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "DASH Per-Meal Sodium Cap",
        targetDisplay: "≤600 mg sodium",
        dishValueDisplay: `${n.sodiumMg} mg Na`,
        status: "optimal",
        impactPoints: 16,
        rationale: "Keeps single restaurant meal under 30% of the 2,000mg daily DASH target.",
        studyCitation: SCIENTIFIC_STUDIES.health_canada_fop.citation,
      });
    } else {
      const pen = n.sodiumMg > 850 ? -20 : -10;
      rawFit += pen;
      takeLessOfChecks.push({
        direction: "less",
        nutrientOrFood: "DASH Per-Meal Sodium Cap",
        targetDisplay: "≤600 mg sodium",
        dishValueDisplay: `${n.sodiumMg} mg Na`,
        status: "caution",
        impactPoints: pen,
        rationale: "Exceeds strict DASH low-sodium restaurant ceiling.",
        studyCitation: SCIENTIFIC_STUDIES.health_canada_fop.citation,
      });
    }

    if ((n.potassiumMg ?? 0) >= 800) {
      rawFit += 10;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Potassium Counter-Balance (Na:K Ratio)",
        targetDisplay: "≥750 mg potassium",
        dishValueDisplay: `${n.potassiumMg} mg K`,
        status: "optimal",
        impactPoints: 10,
        rationale: "High potassium produce promotes renal sodium excretion.",
        studyCitation: SCIENTIFIC_STUDIES.harvard_ahei.citation,
      });
    }
  }

  // --- GLYCEMIC STEADY LENS ---
  if (activeLenses.has("glycemic_steady")) {
    const carbToFibre = n.fibreG > 0 ? n.carbsG / n.fibreG : 99;
    if (n.fibreG >= 10 && carbToFibre <= 6.5) {
      rawFit += 14;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "Low Carb-to-Fibre Glycemic Cushion",
        targetDisplay: "Carb:Fibre ≤ 6.5:1 & ≥10g fibre",
        dishValueDisplay: `${carbToFibre.toFixed(1)}:1 (${n.fibreG}g fibre)`,
        status: "optimal",
        impactPoints: 14,
        rationale: "Dense viscous fibre slows intestinal glucose absorption.",
        studyCitation: SCIENTIFIC_STUDIES.harvard_ahei.citation,
      });
    }
    if (n.proteinG >= 30) {
      rawFit += 10;
      takeMoreOfHits.push({
        direction: "more",
        nutrientOrFood: "High Protein Glycemic Anchor",
        targetDisplay: "≥28g protein",
        dishValueDisplay: `${n.proteinG}g protein`,
        status: "optimal",
        impactPoints: 10,
        rationale: "Blunts postprandial glucose peak.",
        studyCitation: SCIENTIFIC_STUDIES.nutriscore_fsa.citation,
      });
    }
  }

  // --- GENERAL HEALTHY FALLBACK (if no specialized items populated yet) ---
  if (takeMoreOfHits.length === 0) {
    takeMoreOfHits.push({
      direction: "more",
      nutrientOrFood: "Dietary Fibre & Whole Plants",
      targetDisplay: "≥8g fibre",
      dishValueDisplay: `${n.fibreG}g fibre`,
      status: n.fibreG >= 8 ? "optimal" : "acceptable",
      impactPoints: n.fibreG >= 8 ? 10 : 3,
      rationale: "Core AHEI-2010 longevity & gut microbiome metric.",
      studyCitation: SCIENTIFIC_STUDIES.harvard_ahei.citation,
    });
    takeMoreOfHits.push({
      direction: "more",
      nutrientOrFood: "Complete Protein",
      targetDisplay: "≥25g protein",
      dishValueDisplay: `${n.proteinG}g protein`,
      status: n.proteinG >= 25 ? "optimal" : "acceptable",
      impactPoints: n.proteinG >= 25 ? 10 : 2,
      rationale: "Supports lean mass and metabolic steadiness.",
      studyCitation: SCIENTIFIC_STUDIES.nutriscore_fsa.citation,
    });
    rawFit += (n.fibreG >= 8 ? 10 : 2) + (n.proteinG >= 25 ? 10 : 2);
  }

  if (takeLessOfChecks.length === 0) {
    takeLessOfChecks.push({
      direction: "less",
      nutrientOrFood: "Sodium Ceiling",
      targetDisplay: "≤750 mg Na",
      dishValueDisplay: `${n.sodiumMg} mg Na`,
      status: n.sodiumMg <= 750 ? "optimal" : n.sodiumMg <= 900 ? "acceptable" : "caution",
      impactPoints: n.sodiumMg <= 750 ? 6 : -8,
      rationale: "Health Canada per-meal sodium check.",
      studyCitation: SCIENTIFIC_STUDIES.health_canada_fop.citation,
    });
  }

  return {
    fitScore: Math.round(clamp(rawFit, 15, 99)),
    takeMoreOfHits,
    takeLessOfChecks,
  };
}

export function evaluateDish(dish: GtaDish, criteria: DishFilterCriteria): EvaluatedDish {
  const baseline = computeBaselineHealthScore(dish);
  const fit = evaluateBiomarkerFit(
    dish,
    criteria.activeLens,
    criteria.secondaryLens,
    criteria.decisionWeights
  );

  // Check allergen & custom ingredient exclusions first
  const blockedBy: string[] = [];
  for (const alg of criteria.excludedAllergens) {
    if (dish.allergens.includes(alg)) {
      blockedBy.push(`Allergen: ${alg.replace("_", " ")}`);
    }
  }
  for (const rawExcl of criteria.excludedIngredients) {
    const clean = rawExcl.trim().toLowerCase();
    if (!clean) continue;
    const hit = dish.ingredients.find((ing) => ing.toLowerCase().includes(clean));
    if (hit) {
      blockedBy.push(`Ingredient: ${hit}`);
    }
  }

  const cautionReasons: string[] = [];
  const n = dish.nutrients;

  if (criteria.minFibreG !== undefined && n.fibreG < criteria.minFibreG) {
    cautionReasons.push(`Fibre ${n.fibreG}g is below your ${criteria.minFibreG}g target`);
  }
  if (criteria.minProteinG !== undefined && n.proteinG < criteria.minProteinG) {
    cautionReasons.push(`Protein ${n.proteinG}g is below your ${criteria.minProteinG}g target`);
  }
  if (criteria.maxSodiumMg !== undefined && n.sodiumMg > criteria.maxSodiumMg) {
    cautionReasons.push(`Sodium ${n.sodiumMg}mg exceeds your ${criteria.maxSodiumMg}mg limit`);
  }
  if (criteria.maxSaturatedFatG !== undefined && n.saturatedFatG > criteria.maxSaturatedFatG) {
    cautionReasons.push(`Saturated fat ${n.saturatedFatG}g exceeds your ${criteria.maxSaturatedFatG}g limit`);
  }
  if (criteria.maxSugarsG !== undefined && n.sugarsG > criteria.maxSugarsG) {
    cautionReasons.push(`Sugars ${n.sugarsG}g exceed your ${criteria.maxSugarsG}g limit`);
  }

  for (const check of [...fit.takeMoreOfHits, ...fit.takeLessOfChecks]) {
    if (check.status === "caution") {
      cautionReasons.push(`${check.nutrientOrFood}: ${check.dishValueDisplay}`);
    }
  }

  let matchState: DishMatchState;
  if (blockedBy.length > 0) {
    matchState = { type: "excluded_allergen", blockedBy };
  } else if (cautionReasons.length > 0) {
    matchState = { type: "caution", reasons: cautionReasons };
  } else {
    matchState = {
      type: "matches",
      summary: `Meets your ${criteria.activeLens.replace("_", " ")} targets & nutrient thresholds`,
    };
  }

  const combinedRankScore =
    criteria.activeLens === "general_healthy"
      ? Math.round(baseline.score * 0.7 + fit.fitScore * 0.3)
      : Math.round(baseline.score * 0.42 + fit.fitScore * 0.58);

  return {
    dish,
    baselineScore: baseline.score,
    baselineGrade: baseline.grade,
    baselineComponents: baseline.components,
    biomarkerFitScore: fit.fitScore,
    combinedRankScore,
    takeMoreOfHits: fit.takeMoreOfHits,
    takeLessOfChecks: fit.takeLessOfChecks,
    matchState,
  };
}
