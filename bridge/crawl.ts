/**
 * Crawl Uber Eats near a location through your own Chrome and build a dataset:
 * unique restaurants, store links, promos / BOGO status, and every menu item with price.
 *
 *   bun run bridge/crawl.ts [--points-file data/gta-points.json | --pl <encoded location>] [--out data/ubereats-gta.json] [--max-stores 8] [--queries a,b,c]
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
const PL_SINGLE = PL_RAW && PL_RAW.includes("%") ? decodeURIComponent(PL_RAW) : PL_RAW;
const ADDRESS = args.get("address") ?? process.env.UBER_EATS_ADDRESS ?? null;
const POINTS_FILE = args.get("points-file") ?? (PL_SINGLE ? null : "data/gta-points.json");

interface Point { name: string; lat: number; lng: number }
const encodePl = (p: Point) => btoa(encodeURIComponent(JSON.stringify({ address: p.name, latitude: p.lat, longitude: p.lng })));

async function loadPoints(): Promise<{ name: string; pl: string | null }[]> {
  if (POINTS_FILE) {
    try {
      const { points } = JSON.parse(await readFile(path.resolve(POINTS_FILE), "utf8")) as { points: Point[] };
      return points.map((p) => ({ name: p.name, pl: encodePl(p) }));
    } catch (e) {
      console.warn(`[crawl] could not read ${POINTS_FILE}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return [{ name: ADDRESS ?? "default", pl: PL_SINGLE }];
}
/** Revisit stores captured before item links, calories, address or coordinates were collected. */
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
  points?: string[];
  startedAt: string;
  updatedAt: string;
  queriesDone: string[];
  restaurants: DatasetRestaurant[];
}

async function load(): Promise<Dataset> {
  try {
    return JSON.parse(await readFile(OUT, "utf8")) as Dataset;
  } catch {
    return { location: { address: ADDRESS, pl: PL_SINGLE }, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), queriesDone: [], restaurants: [] };
  }
}

async function save(ds: Dataset) {
  ds.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(ds, null, 2));
}

async function postToApp(restaurants: Restaurant[]) {
  try {
    await fetch(`${APP}/api/ingest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "crawl", capturedAt: new Date().toISOString(), restaurants }) });
  } catch {
    /* app not running; file is the source of truth */
  }
}

const isBogo = (promos: string[]) => promos.some((p) => /buy \d+,? get \d+|\bbogo\b|2 for 1|free item/i.test(p));

const ds = await load();
const known = new Map(ds.restaurants.map((r) => [r.storeUrl ?? r.restaurant, r]));
const points = await loadPoints();
ds.points = [...new Set([...(ds.points ?? []), ...points.map((p) => p.name)])];
console.log(`[crawl] ${ds.restaurants.length} restaurants already in ${OUT}; ${QUERIES.length} queries × ${points.length} points`);

const driver = await getDriver();
const h = await driver.open("https://www.ubereats.com/ca");
let newStores = 0;
try {
  for (const point of points) {
  const PL = point.pl;
  console.log(`[crawl] === ${point.name} ===`);
  for (const q of QUERIES) {
    const doneKey = points.length > 1 ? `${point.name}|${q}` : q;
    if (ds.queriesDone.includes(doneKey) && !REVISIT) continue;
    const url = `https://www.ubereats.com/ca/search?q=${encodeURIComponent(q)}${PL ? `&pl=${encodeURIComponent(PL)}` : ""}`;
    console.log(`[crawl] "${q}"`);
    try {
      await h.goto(url);
      await settle(h, (s) => s.stores >= 3, 45_000);
      await sleep(1200);
      const stores = (await h.evaluate<StoreLink[]>(EXPR_STORES)).slice(0, MAX_STORES);
      for (const store of stores) {
        const existing = known.get(store.url);
        const stale = existing && REVISIT && (!existing.items.some((i) => i.url) || !existing.geo || !existing.address);
        if (existing && !stale) {
          if (!existing.foundVia.includes(q)) existing.foundVia.push(q);
          if (points.length > 1 && !existing.foundVia.includes(`@${point.name}`)) existing.foundVia.push(`@${point.name}`);
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
            foundVia: [...new Set([...(existing?.foundVia ?? []), q, ...(points.length > 1 ? [`@${point.name}`] : [])])],
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
      ds.queriesDone.push(doneKey);
      await save(ds);
    } catch (e) {
      console.warn(`[crawl] "${q}" failed: ${e instanceof Error ? e.message : e}`);
    }
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
