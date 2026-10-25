import type { BiomarkerLensId, BiomarkerLensSpec, ScientificStudy } from "./models";

export const SCIENTIFIC_STUDIES: Record<string, ScientificStudy> = {
  nutriscore_fsa: {
    id: "nutriscore_fsa",
    shortTitle: "Nutri-Score / FSA-Ofcom Nutrient Profiling",
    citation: "Julia et al., British Journal of Nutrition (2015); Santé Publique France",
    finding:
      "Validates balancing positive nutrient density (protein, dietary fibre, fruits/vegetables/legumes) against negative load factors (sodium, saturated fat, sugars, caloric density) to score single meals objectively.",
    url: "https://pubmed.ncbi.nlm.nih.gov/26004539/",
    relevance: "baseline_score",
  },
  harvard_ahei: {
    id: "harvard_ahei",
    shortTitle: "Harvard Alternative Healthy Eating Index (AHEI-2010)",
    citation: "Chiuve et al., Journal of Nutrition (2012); 142(6):1009-1018",
    finding:
      "High AHEI-2010 scores (intact whole grains, leafy/cruciferous vegetables, legumes, unsaturated fats, low sodium and low refined sugar) reduce chronic metabolic, cardiovascular, and hepatic disease risk by 19–24%.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3349975/",
    relevance: "baseline_score",
  },
  health_canada_fop: {
    id: "health_canada_fop",
    shortTitle: "Health Canada 2026 Front-of-Package & Dietary Guidelines",
    citation: "Health Canada Regulations Amending the Food and Drug Regulations (FOP Symbol, 2026)",
    finding:
      "Establishes Daily Value thresholds flagging high-risk single-item loads of Sodium (>15–30% DV / >690mg per meal), Saturated Fat (>5g), and Sugars (>15g).",
    url: "https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations.html",
    relevance: "baseline_score",
  },
  bilirubin_cruciferous_ugt1a1: {
    id: "bilirubin_cruciferous_ugt1a1",
    shortTitle: "Cruciferous Vegetables Induce UGT1A1 & Lower Serum Bilirubin",
    citation: "Navarro et al., Journal of Nutrition (2009); 139(9):1685-1691",
    finding:
      "Randomized controlled feeding trial showing Brassica/cruciferous vegetables (broccoli, kale, cabbage) upregulate hepatic UGT1A1 glucuronidation activity and significantly decrease serum bilirubin (particularly in UGT1A1*28 Gilbert's genotype).",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2728690/",
    relevance: "bilirubin",
  },
  bilirubin_fibre_binding: {
    id: "bilirubin_fibre_binding",
    shortTitle: "Dietary Fibre Blocks Enterohepatic Bilirubin Reabsorption",
    citation: "Vitek & Carey, Gastroenterology / Hepatology Reviews on Bilirubin Enterohepatic Cycling",
    finding:
      "Soluble and insoluble dietary fibre (legumes, oats, brown rice, greens) bind unconjugated bilirubin in the intestinal lumen, preventing deconjugation and reabsorption into portal blood.",
    url: "https://pubmed.ncbi.nlm.nih.gov/12782026/",
    relevance: "bilirubin",
  },
  bilirubin_fasting_caloric: {
    id: "bilirubin_fasting_caloric",
    shortTitle: "Caloric Restriction & Fasting Spike Unconjugated Bilirubin",
    citation: "Felsher et al., New England Journal of Medicine (1970); 283:170-172",
    finding:
      "Hypocaloric intake (<400 kcal meals or skipping carbohydrates/lipids) rapidly increases serum unconjugated bilirubin 2-to-3-fold in individuals with Gilbert's syndrome or mild hyperbilirubinemia.",
    url: "https://pubmed.ncbi.nlm.nih.gov/5424008/",
    relevance: "bilirubin",
  },
  iron_absorption_modulation: {
    id: "iron_absorption_modulation",
    shortTitle: "Heme vs. Non-Heme Iron Bioavailability & Chelation",
    citation: "Hallberg & Hulthén, American Journal of Clinical Nutrition (2000); 71(5):1147-1160",
    finding:
      "Heme iron (red meat) is absorbed at 15–35% largely independent of iron stores (risky in high ferritin/hemochromatosis), whereas non-heme plant iron is tightly regulated and enhanced 3x by Vitamin C (>25mg) or inhibited by phytates/polyphenols.",
    url: "https://pubmed.ncbi.nlm.nih.gov/10799377/",
    relevance: "iron",
  },
  hepatic_masld_guidelines: {
    id: "hepatic_masld_guidelines",
    shortTitle: "AASLD / NIDDK Clinical Nutrition in Steatotic & Hepatic Conditions",
    citation: "NIDDK & ACG Clinical Guideline on Nutrition in Liver Disease (2025/2026)",
    finding:
      "Emphasizes adequate high-quality protein (25–35g/meal to prevent sarcopenia), soluble fibre, omega-3/monounsaturated fats, and strict limits on saturated fat, fructose/added sugars, and excess sodium.",
    url: "https://www.niddk.nih.gov/health-information/liver-disease/nafld-nash/eating-diet-nutrition",
    relevance: "hepatic_metabolic",
  },
};

export const BIOMARKER_LENSES: Record<BiomarkerLensId, BiomarkerLensSpec> = {
  general_healthy: {
    id: "general_healthy",
    name: "Evidence Baseline (General Healthy)",
    shortBadge: "Baseline AHEI + Nutri-Score",
    subtitle: "Optimal macro balance, high fibre, whole foods, and low sodium/saturated fat per Health Canada & Harvard AHEI-2010.",
    biomarkerFocus: "General Longevity, Metabolic & Cardiovascular Baseline",
    takeMoreOf: [
      {
        label: "Dietary Fibre (≥7g/meal)",
        target: "7–14g per meal",
        why: "Feeds gut microbiome, blunts post-meal glucose spikes, and supports lipid clearance.",
        studyId: "harvard_ahei",
      },
      {
        label: "Complete Lean Protein (≥25g/meal)",
        target: "25–42g per meal",
        why: "Supports satiety, lean muscle maintenance, and stable glycemic response.",
        studyId: "nutriscore_fsa",
      },
      {
        label: "Whole Grains, Greens & Legumes",
        target: "2+ whole-food plant groups",
        why: "Provides magnesium, potassium, folate, and phytonutrients linked to 20%+ lower chronic disease risk.",
        studyId: "harvard_ahei",
      },
    ],
    takeLessOf: [
      {
        label: "Sodium Load (≤750 mg/meal)",
        limit: "≤750 mg ideal (<950 mg max)",
        why: "Restaurant sauces often hide 1,200–2,000mg sodium in a single bowl.",
        studyId: "health_canada_fop",
      },
      {
        label: "Saturated Fat (≤5g/meal)",
        limit: "≤5.0g per meal (0g trans fat)",
        why: "Excess saturated fat raises ApoB/LDL and hepatic triglyceride storage.",
        studyId: "health_canada_fop",
      },
      {
        label: "Refined / Added Sugars (≤10g/meal)",
        limit: "≤10g non-fruit sugars",
        why: "Sweetened dressings and glazes drive rapid insulin spikes and hepatic lipogenesis.",
        studyId: "harvard_ahei",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 6,
      minProteinG: 22,
      maxSodiumMg: 900,
      maxSaturatedFatG: 6,
      maxSugarsG: 12,
    },
  },

  bilirubin_elevated: {
    id: "bilirubin_elevated",
    name: "Elevated Bilirubin / Gilbert's Lens",
    shortBadge: "Bilirubin · UGT1A1 Support",
    subtitle: "Tailored for unconjugated/mild hyperbilirubinemia: boosts UGT1A1-inducing cruciferous greens, gut-binding soluble fibre, and steady complex carbs while capping fried saturated fats.",
    biomarkerFocus: "Total & Unconjugated Bilirubin · Hepatic Glucuronidation (UGT1A1)",
    takeMoreOf: [
      {
        label: "Cruciferous & Brassica Greens (Broccoli, Kale, Cabbage)",
        target: "1+ cruciferous vegetable serving",
        why: "Sulforaphane & glucosinolates upregulate hepatic UGT1A1 enzymes that conjugate and clear bilirubin (Navarro et al., J Nutr).",
        studyId: "bilirubin_cruciferous_ugt1a1",
      },
      {
        label: "Soluble & Total Fibre (≥8g/meal)",
        target: "≥8g fibre (beans, lentils, brown rice, avocado)",
        why: "Binds bilirubin in the intestinal tract so it is excreted rather than reabsorbed via enterohepatic circulation.",
        studyId: "bilirubin_fibre_binding",
      },
      {
        label: "Steady Complex Carbs & Adequate Calories (420–780 kcal)",
        target: "≥35g complex carbs, ≥400 kcal",
        why: "Skipping meals or eating ultra-low-calorie (<320 kcal) triggers a 2–3x fasting spike in unconjugated bilirubin (Felsher et al., NEJM).",
        studyId: "bilirubin_fasting_caloric",
      },
      {
        label: "Lean / Plant Protein (≥24g/meal)",
        target: "24–40g clean protein",
        why: "Supports hepatic albumin & enzyme synthesis without heavy biliary lipid strain.",
        studyId: "hepatic_masld_guidelines",
      },
    ],
    takeLessOf: [
      {
        label: "Saturated Fat & Fried Oils (≤5.0g/meal)",
        limit: "≤5.0g saturated fat",
        why: "Heavy saturated fats and fried oils slow biliary clearance and increase hepatic lipid stress.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "Refined Sugars & Sweet Glazes (≤10g/meal)",
        limit: "≤10g sugars",
        why: "High fructose/sucrose glazes drive hepatic de novo lipogenesis and compete with metabolic clearance.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "Excess Sodium (≤800 mg/meal)",
        limit: "≤800 mg sodium",
        why: "Keeps portal and systemic fluid balance optimal.",
        studyId: "health_canada_fop",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 8,
      minProteinG: 22,
      maxSodiumMg: 800,
      maxSaturatedFatG: 5,
      maxSugarsG: 10,
      minCalories: 380,
    },
  },

  iron_high: {
    id: "iron_high",
    name: "High Iron / Ferritin Reduction Lens",
    shortBadge: "Iron Overload · Low Heme",
    subtitle: "For elevated ferritin, high transferrin saturation, or hemochromatosis: avoids unregulated heme iron (red meat) and boosts plant proteins & natural polyphenol/phytate chelators.",
    biomarkerFocus: "Serum Ferritin · Transferrin Saturation · Hepatic Iron Load",
    takeMoreOf: [
      {
        label: "Non-Heme Plant & Poultry/Fish Proteins",
        target: "Tofu, tempeh, legumes, chicken, or fish (0g red meat)",
        why: "Intestinal absorption of non-heme plant iron is downregulated when ferritin is high, unlike red-meat heme iron.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "Phytate & Polyphenol-Rich Whole Grains & Legumes",
        target: "Quinoa, brown rice, black beans, lentils, leafy greens",
        why: "Natural phytates and polyphenols bind non-heme iron in the gut lumen, reducing meal iron uptake by 40–60%.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "Antioxidant & Fibre-Rich Produce (≥8g fibre)",
        target: "≥8g dietary fibre",
        why: "Counters free-radical oxidative stress in hepatic tissue.",
        studyId: "hepatic_masld_guidelines",
      },
    ],
    takeLessOf: [
      {
        label: "Heme Iron / Red Meat (Beef, Steak, Pork, Lamb)",
        limit: "Exclude red meat (0g heme red meat)",
        why: "Heme iron bypasses strict duodenal feedback and is absorbed at 15–35% even when ferritin is elevated.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "Total Meal Iron Load (≤4.2 mg/meal)",
        limit: "≤4.2 mg total iron",
        why: "Prevents cumulative dietary iron overload across daily meals.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "High Vitamin C Paired with High-Iron Meat",
        limit: "Avoid citrus + red meat combos",
        why: "Ascorbic acid converts ferric to ferrous iron and dramatically increases intestinal iron absorption.",
        studyId: "iron_absorption_modulation",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 7,
      minProteinG: 20,
      maxSodiumMg: 850,
      maxSaturatedFatG: 5.5,
      maxIronMg: 4.2,
    },
  },

  iron_low: {
    id: "iron_low",
    name: "Low Iron / Ferritin Builder Lens",
    shortBadge: "Iron Deficiency · Bioavailable Fe + Vit C",
    subtitle: "For low ferritin or iron-deficiency anemia: prioritizes bioavailable heme & rich non-heme iron paired with Vitamin C absorption enhancers (citrus, bell peppers, broccoli).",
    biomarkerFocus: "Hemoglobin · Serum Ferritin · Iron Bioavailability",
    takeMoreOf: [
      {
        label: "Bioavailable Iron Sources (≥3.5 mg/meal)",
        target: "≥3.5 mg iron (steak, lentils, spinach, black beans, pumpkin seeds)",
        why: "Directly supplies elemental iron to rebuild depleted ferritin stores.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "Vitamin C Absorption Co-Factors (≥25 mg/meal)",
        target: "≥25 mg Vitamin C in same meal",
        why: "Vitamin C chelates non-heme iron into a soluble ferrous complex, multiplying absorption up to 3–4x (Hallberg et al., AJCN).",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "High Complete Protein (≥26g/meal)",
        target: "≥26g protein (meat/fish/poultry 'MFP factor')",
        why: "Cysteine-containing peptides in muscle protein ('MFP factor') double non-heme iron absorption from vegetables and grains.",
        studyId: "iron_absorption_modulation",
      },
    ],
    takeLessOf: [
      {
        label: "Low-Iron Meals (<2.2 mg/meal)",
        limit: "Avoid meals with <2.2 mg iron",
        why: "Takes up caloric budget without contributing meaningfully to daily iron repletion.",
        studyId: "iron_absorption_modulation",
      },
      {
        label: "Excessive Refined Sugar & Sodium",
        limit: "≤850 mg sodium, ≤12g sugar",
        why: "Supports low systemic inflammation (high hepcidin from inflammation blocks iron export).",
        studyId: "harvard_ahei",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 5,
      minProteinG: 25,
      maxSodiumMg: 900,
      minIronMg: 3.2,
    },
  },

  fatty_liver_masld: {
    id: "fatty_liver_masld",
    name: "Hepatic Lipid / MASLD (ALT·AST·Triglycerides)",
    shortBadge: "Hepatic Lipid · Low Sat-Fat & Sugar",
    subtitle: "Mediterranean-style hepatic protocol: high soluble fibre, omega-3/monounsaturated fats, and ≥25g lean protein while strictly limiting saturated fat and fructose/added sugars.",
    biomarkerFocus: "ALT · AST · GGT · Hepatic Triglycerides",
    takeMoreOf: [
      {
        label: "Soluble Fibre & Intact Whole Grains (≥8g/meal)",
        target: "≥8g fibre",
        why: "Reduces hepatic de novo lipogenesis and improves portal insulin sensitivity.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "Omega-3 & Monounsaturated Fats (Salmon, Avocado, Olive Oil)",
        target: "Unsaturated-to-saturated fat ratio > 3:1",
        why: "Promotes hepatic beta-oxidation of fatty acids over triglyceride storage.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "High Lean or Plant Protein (≥26g/meal)",
        target: "26–45g protein",
        why: "Prevents sarcopenia and supports VLDL lipid export from hepatocytes.",
        studyId: "hepatic_masld_guidelines",
      },
    ],
    takeLessOf: [
      {
        label: "Saturated Fat (≤4.5g/meal)",
        limit: "≤4.5g saturated fat",
        why: "Saturated fat directly increases intrahepatic triglyceride accumulation.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "Sugars & Sweetened Sauces (≤8g/meal)",
        limit: "≤8g total sugars",
        why: "Fructose is metabolized almost exclusively in the liver into fatty acids and uric acid.",
        studyId: "hepatic_masld_guidelines",
      },
      {
        label: "Sodium (≤750 mg/meal)",
        limit: "≤750 mg sodium",
        why: "Reduces vascular stiffness and fluid retention.",
        studyId: "health_canada_fop",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 8,
      minProteinG: 25,
      maxSodiumMg: 750,
      maxSaturatedFatG: 4.5,
      maxSugarsG: 8,
    },
  },

  sodium_bp: {
    id: "sodium_bp",
    name: "Sodium & Blood Pressure Guard (DASH)",
    shortBadge: "Low Sodium · High Potassium",
    subtitle: "Strict restaurant sodium ceiling (≤600 mg/meal) paired with high potassium produce (avocado, leafy greens, sweet potato, beans) for optimal Na:K balance.",
    biomarkerFocus: "Blood Pressure · Vascular & Renal Sodium-Potassium Ratio",
    takeMoreOf: [
      {
        label: "Potassium-Rich Whole Produce (≥600 mg K/meal)",
        target: "≥600 mg potassium",
        why: "Dietary potassium promotes natriuresis (renal sodium excretion) and relaxes vascular smooth muscle.",
        studyId: "harvard_ahei",
      },
      {
        label: "Dietary Fibre (≥7g/meal)",
        target: "≥7g fibre",
        why: "Core pillar of the DASH clinical blood-pressure trial.",
        studyId: "harvard_ahei",
      },
    ],
    takeLessOf: [
      {
        label: "Strict Restaurant Sodium Cap (≤600 mg/meal)",
        limit: "≤600 mg sodium",
        why: "Keeps a single restaurant meal under ~30% of the 2,000mg daily clinical target.",
        studyId: "health_canada_fop",
      },
      {
        label: "Saturated Fat (≤5g/meal)",
        limit: "≤5g saturated fat",
        why: "Supports endothelial function alongside sodium reduction.",
        studyId: "health_canada_fop",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 7,
      minProteinG: 20,
      maxSodiumMg: 600,
      maxSaturatedFatG: 5,
    },
  },

  glycemic_steady: {
    id: "glycemic_steady",
    name: "Glycemic & Insulin Steady (Glucose / A1c)",
    shortBadge: "Low GI · High Fibre:Carb Ratio",
    subtitle: "Maximizes protein + soluble fibre cushioning while minimizing free sugars and refined starches to flatten post-meal glucose curves.",
    biomarkerFocus: "Fasting Glucose · HbA1c · Postprandial Insulin",
    takeMoreOf: [
      {
        label: "High Fibre-to-Carb Cushion (≥8g fibre/meal)",
        target: "≥8g fibre (carb:fibre ratio < 6:1)",
        why: "Viscous fibre slows intestinal alpha-amylase and glucose absorption.",
        studyId: "harvard_ahei",
      },
      {
        label: "High Protein Anchor (≥28g/meal)",
        target: "≥28g protein",
        why: "Stimulates GLP-1 and slows gastric emptying.",
        studyId: "nutriscore_fsa",
      },
    ],
    takeLessOf: [
      {
        label: "Sugars (≤8g/meal)",
        limit: "≤8g sugars",
        why: "Eliminates rapid glycemic spikes from sweetened dressings or fruit bases.",
        studyId: "health_canada_fop",
      },
      {
        label: "Saturated Fat (≤5.5g/meal)",
        limit: "≤5.5g saturated fat",
        why: "High saturated fat acutely impairs skeletal muscle insulin signaling.",
        studyId: "harvard_ahei",
      },
    ],
    defaultNumericTargets: {
      minFibreG: 8,
      minProteinG: 28,
      maxSodiumMg: 850,
      maxSaturatedFatG: 5.5,
      maxSugarsG: 8,
    },
  },
};

export const BIOMARKER_LENS_LIST: BiomarkerLensSpec[] = Object.values(BIOMARKER_LENSES);
