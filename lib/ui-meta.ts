import type { BiomarkerLensId } from "./models";
import type { MenuSource } from "./uber-eats";
import type { ProteinPreference } from "./intent";

export const LENS_META: Record<BiomarkerLensId, { label: string; icon: string }> = {
  general_healthy: { label: "Healthy", icon: "lucide:leaf" },
  bilirubin_elevated: { label: "Bilirubin", icon: "lucide:droplet" },
  iron_high: { label: "Iron high", icon: "lucide:magnet" },
  iron_low: { label: "Iron low", icon: "lucide:battery-low" },
  fatty_liver_masld: { label: "Fatty liver", icon: "lucide:activity" },
  sodium_bp: { label: "Blood pressure", icon: "lucide:heart-pulse" },
  glycemic_steady: { label: "Blood sugar", icon: "lucide:gauge" },
};

export const PROTEIN_ICON: Record<ProteinPreference, string> = {
  chicken: "lucide:drumstick",
  fish: "lucide:fish",
  plant: "lucide:sprout",
  beef: "lucide:beef",
  any: "lucide:utensils",
};

export const SOURCE_META: Record<MenuSource, { label: string; icon: string; live: boolean }> = {
  dataset: { label: "Uber Eats menu", icon: "simple-icons:ubereats", live: false },
  catalogue: { label: "Verified GTA catalogue", icon: "lucide:book-open-check", live: false },
};

export const cad = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${n.toFixed(2)}`);

/** Short names for the scoring engine's components (`ScoreComponent.id`). */
const DRIVER_LABEL: Record<string, string> = {
  protein_density: "Protein",
  dietary_fibre: "Fibre",
  whole_food_bioactives: "Whole foods",
  sodium_load: "Sodium",
  saturated_fat: "Sat fat",
  sugar_caloric: "Sugar",
};

export function driverLabel(id: string): string {
  return DRIVER_LABEL[id] ?? id.replace(/_/g, " ");
}
