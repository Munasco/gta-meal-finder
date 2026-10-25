/**
 * Snapshot mode (Vercel or any Node host): the crawl dataset and estimates ship with the build and are
 * searched in-process. Enabled with DATASET_LOCAL=1; `npm run data:pull` fetches the files from Blob.
 * Leave it unset to search Uber Eats live through the local Chrome helper (bun run bridge).
 */
import { indexDataset, mergeEstimates, searchDataset, type DatasetQuery, type DsRestaurant } from "./dataset-search";

interface Loaded {
  restaurants: DsRestaurant[];
  stats: { restaurants: number; items: number; withHealth: number };
}

/** One load per process; a failed load is retried on the next call. */
let loading: Promise<Loaded> | null = null;

export function localDatasetEnabled(): boolean {
  return process.env.DATASET_LOCAL === "1";
}

async function read(): Promise<Loaded> {
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
  indexDataset(restaurants);
  let items = 0;
  let withHealth = 0;
  for (const r of restaurants) for (const i of r.items) { items += 1; if (i.health) withHealth += 1; }
  return { restaurants, stats: { restaurants: restaurants.length, items, withHealth } };
}

function load(): Promise<Loaded> {
  if (!loading) {
    loading = read().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

/** Start reading the snapshot now so it overlaps with intent analysis instead of following it. */
export function warmLocalDataset(): void {
  if (localDatasetEnabled()) void load().catch(() => null);
}

export async function searchLocalDataset(q: DatasetQuery): Promise<DsRestaurant[]> {
  return searchDataset((await load()).restaurants, q);
}

export async function localDatasetStats() {
  return (await load()).stats;
}
