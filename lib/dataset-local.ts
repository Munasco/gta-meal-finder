/**
 * Snapshot mode (Vercel / any Node host): the crawl dataset and estimates ship with the build and are
 * searched in-process. Enabled with DATASET_LOCAL=1. Never used on the Cloudflare dev runtime, which
 * has no filesystem and asks the local helper instead.
 */
import { mergeEstimates, searchDataset, type DatasetQuery, type DsRestaurant } from "./dataset-search";

let cache: { restaurants: DsRestaurant[]; loadedAt: number } | null = null;

export function localDatasetEnabled(): boolean {
  return process.env.DATASET_LOCAL === "1";
}

async function load(): Promise<DsRestaurant[]> {
  if (cache) return cache.restaurants;
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = process.env.DATASET_DIR ?? path.join(process.cwd(), "data");
  const ds = JSON.parse(await fs.readFile(path.join(root, "ubereats-gta.json"), "utf8")) as { restaurants?: DsRestaurant[] };
  const restaurants = ds.restaurants ?? [];
  try {
    const estimates = JSON.parse(await fs.readFile(path.join(root, "health-estimates.json"), "utf8")) as Record<string, unknown>;
    mergeEstimates(restaurants, estimates);
  } catch {
    /* no estimates shipped */
  }
  cache = { restaurants, loadedAt: Date.now() };
  return restaurants;
}

export async function searchLocalDataset(q: DatasetQuery): Promise<DsRestaurant[]> {
  return searchDataset(await load(), q);
}

export async function localDatasetStats() {
  const rs = await load();
  return { restaurants: rs.length, items: rs.reduce((n, r) => n + r.items.length, 0), withHealth: rs.reduce((n, r) => n + r.items.filter((i) => i.health).length, 0) };
}
