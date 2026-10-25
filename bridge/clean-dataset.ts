/**
 * Drop non-restaurant stores (grocery, convenience, pharmacy, retail) and junk rows from the crawl dataset
 * and their estimates. Run after a crawl finishes (never while one is writing the file).
 *
 *   bun run bridge/clean-dataset.ts [--file data/ubereats-gta.json] [--dry]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNonRestaurantName } from "../lib/store-filter";

const args = new Set(process.argv.slice(2));
const FILE = path.resolve(process.env.DATASET_PATH ?? "data/ubereats-gta.json");
const HEALTH = path.resolve(process.env.HEALTH_PATH ?? "data/health-estimates.json");
const DRY = args.has("--dry");

interface R { restaurant: string; storeUrl: string | null; items: { name: string }[] }
const ds = JSON.parse(await readFile(FILE, "utf8")) as { restaurants: R[] };
const before = ds.restaurants.length;
const seen = new Set<string>();
const dropped: string[] = [];
ds.restaurants = ds.restaurants.filter((r) => {
  const key = r.storeUrl ?? r.restaurant.toLowerCase();
  if (isNonRestaurantName(r.restaurant) || seen.has(key)) {
    dropped.push(r.restaurant);
    return false;
  }
  seen.add(key);
  return true;
});
console.log(`[clean] ${before} → ${ds.restaurants.length} restaurants; dropped ${dropped.length}: ${dropped.slice(0, 25).join(" · ")}${dropped.length > 25 ? " …" : ""}`);
if (!DRY) {
  await writeFile(FILE, JSON.stringify(ds, null, 2));
  try {
    const est = JSON.parse(await readFile(HEALTH, "utf8")) as Record<string, unknown>;
    const keep = new Set(ds.restaurants.map((r) => r.restaurant.trim().toLowerCase()));
    const n = Object.keys(est).length;
    for (const k of Object.keys(est)) if (!keep.has(k.split("|")[0])) delete est[k];
    await writeFile(HEALTH, JSON.stringify(est));
    console.log(`[clean] estimates ${n} → ${Object.keys(est).length}`);
  } catch {
    /* no estimates file */
  }
}
