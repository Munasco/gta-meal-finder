/**
 * Crawl Uber Eats near a location through your own Chrome and build a dataset:
 * unique restaurants, store links, promos / BOGO status, and every menu item with price.
 *
 *   bun run bridge/crawl.ts [--pl <encoded location>] [--out data/ubereats-gta.json] [--max-stores 8] [--queries a,b,c]
 *
 * Progress is written to the output file after every store, so it is safe to stop and resume:
 * stores already in the file are skipped. Results are also posted to the app's /api/ingest.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EXPR_EXTRACT, EXPR_STORES, getDriver, scrollThrough, settle, sleep, type Restaurant, type StoreLink } from "./uber";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args.set(a.slice(2), process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "1");
}

const APP = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const OUT = path.resolve(args.get("out") ?? "data/ubereats-gta.json");
const MAX_STORES = Number(args.get("max-stores") ?? 8);
const PL_RAW = args.get("pl") ?? process.env.UBER_EATS_PL ?? null;
const PL = PL_RAW && PL_RAW.includes("%") ? decodeURIComponent(PL_RAW) : PL_RAW;
const ADDRESS = args.get("address") ?? process.env.UBER_EATS_ADDRESS ?? null;
/** Revisit stores captured before item links / calories were collected. */
const REVISIT = args.has("revisit");

const DEFAULT_QUERIES = [
  "healthy", "salad", "bowl", "grilled chicken", "chicken", "salmon", "poke", "sushi", "mediterranean", "greek", "shawarma",
  "middle eastern", "indian", "thai", "vietnamese", "pho", "korean", "japanese", "ramen", "chinese", "mexican", "burrito",
  "caribbean", "jamaican", "italian", "pizza", "burger", "sandwich", "wrap", "wings", "vegan", "vegetarian", "halal",
  "breakfast", "soup", "noodles", "bbq", "portuguese", "nandos", "chipotle", "freshii", "subway", "popeyes", "osmows",
  "deals", "bogo",
];
const QUERIES = (args.get("queries")?.split(",").map((q) => q.trim()).filter(Boolean)) ?? DEFAULT_QUERIES;

interface DatasetRestaurant extends Restaurant {
  bogo: boolean;
  promos: string[];
  foundVia: string[];
  itemCount: number;
  capturedAt: string;
}
interface Dataset {
  location: { address: string | null; pl: string | null };
  startedAt: string;
  updatedAt: string;
  queriesDone: string[];
  restaurants: DatasetRestaurant[];
}

async function load(): Promise<Dataset> {
  try {
    return JSON.parse(await readFile(OUT, "utf8")) as Dataset;
  } catch {
    return { location: { address: ADDRESS, pl: PL }, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), queriesDone: [], restaurants: [] };
  }
}

async function save(ds: Dataset) {
  ds.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(ds, null, 2));
}

async function postToApp(restaurants: Restaurant[]) {
  try {
    await fetch(`${APP}/api/ingest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "crawl", capturedAt: new Date().toISOString(), pl: PL, restaurants }) });
  } catch {
    /* app not running; file is the source of truth */
  }
}

const isBogo = (promos: string[]) => promos.some((p) => /buy \d+,? get \d+|\bbogo\b|2 for 1|free item/i.test(p));

const ds = await load();
const known = new Map(ds.restaurants.map((r) => [r.storeUrl ?? r.restaurant, r]));
console.log(`[crawl] ${ds.restaurants.length} restaurants already in ${OUT}; ${QUERIES.length} queries; location ${ADDRESS ?? PL ?? "(Uber default)"}`);

const driver = await getDriver();
const h = await driver.open("https://www.ubereats.com/ca");
let newStores = 0;
try {
  for (const q of QUERIES) {
    if (ds.queriesDone.includes(q) && !REVISIT) continue;
    const url = `https://www.ubereats.com/ca/search?q=${encodeURIComponent(q)}${PL ? `&pl=${encodeURIComponent(PL)}` : ""}`;
    console.log(`[crawl] "${q}"`);
    try {
      await h.goto(url);
      await settle(h, (s) => s.stores >= 3, 45_000);
      await sleep(1200);
      const stores = (await h.evaluate<StoreLink[]>(EXPR_STORES)).slice(0, MAX_STORES);
      for (const store of stores) {
        const existing = known.get(store.url);
        const stale = existing && REVISIT && !existing.items.some((i) => i.url);
        if (existing && !stale) {
          if (!existing.foundVia.includes(q)) existing.foundVia.push(q);
          for (const p of store.promos) if (!existing.promos.includes(p)) existing.promos.push(p);
          existing.bogo = isBogo(existing.promos);
          continue;
        }
        try {
          await h.goto(store.url);
          await settle(h, (s) => s.ld > 0, 20_000);
          await scrollThrough(h);
          const found = await h.evaluate<Restaurant[]>(EXPR_EXTRACT);
          const r = found[0];
          if (!r || r.items.length === 0) {
            console.log(`[crawl]   ${store.name}: no menu`);
            continue;
          }
          const entry: DatasetRestaurant = {
            ...r,
            restaurant: r.restaurant || store.name,
            storeUrl: store.url,
            promos: [...new Set([...(existing?.promos ?? []), ...store.promos])],
            bogo: isBogo([...(existing?.promos ?? []), ...store.promos]),
            foundVia: [...new Set([...(existing?.foundVia ?? []), q])],
            itemCount: r.items.length,
            capturedAt: new Date().toISOString(),
          };
          if (existing) ds.restaurants[ds.restaurants.indexOf(existing)] = entry;
          else ds.restaurants.push(entry);
          known.set(store.url, entry);
          newStores++;
          console.log(`[crawl]   + ${entry.restaurant} (${entry.itemCount} items${entry.bogo ? ", BOGO" : ""})`);
          await save(ds);
          await postToApp([{ ...entry }]);
        } catch (e) {
          console.warn(`[crawl]   ${store.name}: ${e instanceof Error ? e.message : e}`);
        }
      }
      ds.queriesDone.push(q);
      await save(ds);
    } catch (e) {
      console.warn(`[crawl] "${q}" failed: ${e instanceof Error ? e.message : e}`);
    }
  }
} finally {
  await h.close();
  await save(ds);
}
const bogo = ds.restaurants.filter((r) => r.bogo).length;
const items = ds.restaurants.reduce((n, r) => n + r.itemCount, 0);
console.log(`[crawl] done: ${ds.restaurants.length} restaurants (${newStores} new), ${items} items, ${bogo} with BOGO → ${OUT}`);
process.exit(0);
