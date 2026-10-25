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
  browser_bridge: { label: "Uber Eats · live via your Chrome", icon: "simple-icons:ubereats", live: true },
  browser_import: { label: "Uber Eats · captured from your browser", icon: "simple-icons:ubereats", live: true },
  uber_eats_official_mcp: { label: "Uber Eats · official MCP", icon: "simple-icons:ubereats", live: true },
  apify_uber_eats: { label: "Uber Eats · Apify", icon: "simple-icons:ubereats", live: true },
  catalogue: { label: "Verified GTA catalogue", icon: "lucide:book-open-check", live: false },
};

export const cad = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${n.toFixed(2)}`);

/** Short names for the scoring engine's component labels. */
export function shortDriver(label: string): string {
  if (/protein/i.test(label)) return "Protein";
  if (/fibre|fiber/i.test(label)) return "Fibre";
  if (/bioactive|whole/i.test(label)) return "Whole foods";
  if (/sodium/i.test(label)) return "Sodium";
  if (/saturated|trans/i.test(label)) return "Sat fat";
  if (/sugar|glycemic/i.test(label)) return "Sugar";
  return label;
}
