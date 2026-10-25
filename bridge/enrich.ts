/**
 * Add a Decision-1 health estimate to every item in the crawl dataset.
 *
 *   bun run enrich [--file data/ubereats-gta.json] [--concurrency 4] [--limit 50] [--only "Nando"]
 *
 * Estimates are stored in a separate file (data/health-estimates.json, keyed by restaurant + item)
 * so the crawl can keep rewriting the dataset in parallel. Resumable: existing keys are skipped.
 * Enriched restaurants are re-posted to the app's /api/ingest as they complete.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { estimateItemHealth, type ItemHealthEstimate } from "../lib/health-estimate";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args.set(a.slice(2), process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "1");
}

const FILE = path.resolve(args.get("file") ?? "data/ubereats-gta.json");
const HEALTH_FILE = path.resolve(args.get("health-file") ?? "data/health-estimates.json");
export const healthKey = (restaurant: string, item: string) => `${restaurant.trim().toLowerCase()}|${item.trim().toLowerCase()}`;
const CONCURRENCY = Number(args.get("concurrency") ?? 4);
const LIMIT = Number(args.get("limit") ?? Infinity);
const ONLY = args.get("only")?.toLowerCase() ?? null;
/** Re-estimate items whose name matches this regex (e.g. new USDA components). */
const REDO_MATCH = args.get("redo-match") ? new RegExp(args.get("redo-match")!, "i") : null;
/** Re-estimate sides / drinks / desserts / extras whose estimate exceeds this many kcal. */
const REDO_SMALL_KCAL = args.get("redo-small-kcal") ? Number(args.get("redo-small-kcal")) : null;
const APP = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

async function loadEnv() {
  // bun loads .env automatically; .dev.vars holds the same keys for the worker. Read it as a fallback.
  if (process.env.AZURE_DECISION_KEY) return;
  try {
    for (const line of (await readFile(".dev.vars", "utf8")).split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .dev.vars */
  }
}
await loadEnv();
const config = {
  endpoint: process.env.AZURE_DECISION_ENDPOINT ?? "https://terox-wcus-foundry.services.ai.azure.com/providers/microsoft/v1/systemone",
  apiKey: process.env.AZURE_DECISION_KEY,
  deployment: process.env.AZURE_DECISION_DEPLOYMENT ?? "decision-1",
};
if (!config.apiKey) {
  console.error("AZURE_DECISION_KEY is not set");
  process.exit(1);
}

interface Item { name: string; description: string; price: number | null; section: string | null; health?: ItemHealthEstimate | null }
interface Restaurant { restaurant: string; items: Item[]; [k: string]: unknown }
interface Dataset { restaurants: Restaurant[]; updatedAt?: string; [k: string]: unknown }

const ds = JSON.parse(await readFile(FILE, "utf8")) as Dataset;
let estimates: Record<string, ItemHealthEstimate> = {};
try {
  estimates = JSON.parse(await readFile(HEALTH_FILE, "utf8")) as Record<string, ItemHealthEstimate>;
} catch {
  estimates = {};
}
for (const r of ds.restaurants) for (const i of r.items) {
  const e = estimates[healthKey(r.restaurant, i.name)];
  let keep = Boolean(e && typeof e.mainProtein === "string" && e.nutrients && Array.isArray(e.components)); // older estimates lack USDA components
  if (keep && REDO_MATCH && REDO_MATCH.test(i.name)) keep = false;
  if (keep && REDO_SMALL_KCAL !== null && e && ["side", "drink", "dessert", "sauce_or_extra"].includes(e.kind) && e.nutrients.calories > REDO_SMALL_KCAL) keep = false;
  i.health = keep ? e! : null;
}
const todo = ds.restaurants.filter((r) => !ONLY || r.restaurant.toLowerCase().includes(ONLY));
const pending = todo.reduce((n, r) => n + r.items.filter((i) => !i.health).length, 0);
console.log(`[enrich] ${todo.length} restaurants, ${pending} items without an estimate (limit ${LIMIT === Infinity ? "none" : LIMIT}, concurrency ${CONCURRENCY})`);

let done = 0;
let failed = 0;
const t0 = Date.now();

async function runPool<T>(items: T[], worker: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await worker(item);
      }
    })
  );
}

for (const r of todo) {
  const items = r.items.filter((i) => !i.health);
  if (items.length === 0) continue;
  if (done >= LIMIT) break;
  await runPool(items, async (item) => {
    if (done >= LIMIT) return;
    try {
      item.health = await estimateItemHealth({ restaurant: r.restaurant, name: item.name, description: item.description, section: item.section, price: item.price }, config);
      estimates[healthKey(r.restaurant, item.name)] = item.health;
      done++;
    } catch (e) {
      failed++;
      if (failed <= 5) console.warn(`[enrich] ${r.restaurant} / ${item.name}: ${e instanceof Error ? e.message : e}`);
      await new Promise((res) => setTimeout(res, 1500));
    }
  });
  await writeFile(HEALTH_FILE, JSON.stringify(estimates));
  const rate = done / Math.max(1, (Date.now() - t0) / 1000);
  console.log(`[enrich] ${r.restaurant}: ${r.items.filter((i) => i.health).length}/${r.items.length} · total ${done} done, ${failed} failed, ${rate.toFixed(1)}/s`);
  try {
    await fetch(`${APP}/api/ingest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "enrich", restaurants: [r] }) });
  } catch {
    /* app not running */
  }
}

const withHealth = ds.restaurants.reduce((n, r) => n + r.items.filter((i) => i.health).length, 0);
const total = ds.restaurants.reduce((n, r) => n + r.items.length, 0);
console.log(`[enrich] done: ${withHealth}/${total} items have estimates (${done} new, ${failed} failed) in ${Math.round((Date.now() - t0) / 1000)}s → ${HEALTH_FILE}`);
process.exit(0);
