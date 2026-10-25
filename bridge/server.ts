/**
 * Local browser helper for Meal Finder.
 *
 * Uber Eats serves a verification page to plain server requests, so this helper uses your own
 * Chrome instead. It prefers Open Browser Use (`obu`, your real logged-in Chrome profile via the
 * extension) and falls back to a Playwright-launched Chrome window. It opens the Uber Eats search
 * page at your location, visits the top stores, and reads the menu each store page embeds as
 * JSON-LD. Results go back to the app and are stored via POST /api/ingest.
 *
 *   bun run bridge            # listens on http://127.0.0.1:5174
 *
 * Env: BRIDGE_PORT, APP_URL (default http://127.0.0.1:5173), BRIDGE_DRIVER=obu|playwright,
 *      BRIDGE_HEADLESS=1, BRIDGE_PROFILE (default ./.bridge-profile), BRIDGE_CHROME_PATH
 */
import { existsSync } from "node:fs";
import { mergeEstimates, searchDataset, type DsRestaurant } from "../lib/dataset-search";
import { OBU_REGISTRY, cache, search, state } from "./uber";

const PORT = Number(process.env.BRIDGE_PORT ?? 5174);
const APP = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
let lastError: string | null = null;
let busy = false;
let datasetCache: { stamp: string; body: string; restaurants: DsRestaurant[] } | null = null;

async function loadDataset(): Promise<DsRestaurant[]> {
  const file = Bun.file(process.env.DATASET_PATH ?? "data/ubereats-gta.json");
  if (!(await file.exists())) return [];
  const healthFile = Bun.file(process.env.HEALTH_PATH ?? "data/health-estimates.json");
  const stamp = `${file.lastModified}:${(await healthFile.exists()) ? healthFile.lastModified : 0}`;
  if (datasetCache?.stamp !== stamp) {
    const ds = (await file.json()) as { restaurants?: DsRestaurant[] };
    const restaurants = ds.restaurants ?? [];
    if (await healthFile.exists()) mergeEstimates(restaurants, (await healthFile.json()) as Record<string, unknown>);
    datasetCache = { stamp, body: JSON.stringify({ restaurants }), restaurants };
    console.log(`[bridge] dataset loaded: ${restaurants.length} restaurants, ${restaurants.reduce((n, r) => n + r.items.length, 0)} items`);
  }
  return datasetCache.restaurants;
}

async function forwardToApp(payload: unknown) {
  try {
    const r = await fetch(`${APP}/api/ingest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.ok;
  } catch {
    return false;
  }
}

/* --------------------------------- server --------------------------------- */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 255,
  async fetch(req: Request) {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (pathname === "/health") {
      return json({ ok: true, driver: state.activeDriver ?? (existsSync(OBU_REGISTRY) ? "obu" : "playwright"), browser: state.obuConnected || state.pwConnected, busy, lastError, cached: cache.size });
    }

    if (pathname === "/dataset/stats") {
      const rs = await loadDataset();
      const items = rs.reduce((n, r) => n + r.items.length, 0);
      const withHealth = rs.reduce((n, r) => n + r.items.filter((i) => i.health).length, 0);
      return json({ restaurants: rs.length, items, withHealth });
    }

    if (pathname === "/dataset/search" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { terms?: string[]; hint?: string | null; origin?: { lat: number; lng: number }; rangeKm?: number; limit?: number; itemsPerRestaurant?: number };
      const rs = await loadDataset();
      const result = searchDataset(rs, {
        terms: Array.isArray(body.terms) ? body.terms.filter((t): t is string => typeof t === "string").slice(0, 12) : [],
        hint: typeof body.hint === "string" ? body.hint : null,
        origin: body.origin && Number.isFinite(body.origin.lat) ? body.origin : undefined,
        rangeKm: typeof body.rangeKm === "number" ? body.rangeKm : undefined,
        limit: Math.min(Math.max(body.limit ?? 30, 1), 80),
        itemsPerRestaurant: Math.min(Math.max(body.itemsPerRestaurant ?? 60, 5), 200),
      });
      return json({ restaurants: result, total: rs.length });
    }

    if (pathname === "/dataset") {
      await loadDataset();
      return new Response(datasetCache?.body ?? '{"restaurants":[]}', { headers: { "Content-Type": "application/json", ...CORS } });
    }

    if (pathname === "/ingest" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON" }, 400);
      return json({ ok: await forwardToApp(body) });
    }

    if (pathname === "/search" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { query?: string; pl?: string | null; maxStores?: number; prefer?: string | null };
      const query = body.query?.trim();
      if (!query) return json({ error: "query is required" }, 400);
      if (busy) return json({ error: "A search is already running" }, 429);
      busy = true;
      const t0 = Date.now();
      try {
        const restaurants = await search(query, body.pl ?? null, Math.min(Math.max(body.maxStores ?? 4, 1), 8), body.prefer ?? null);
        lastError = null;
        await forwardToApp({ source: "bridge", capturedAt: new Date().toISOString(), pl: body.pl ?? null, restaurants });
        return json({ restaurants, driver: state.activeDriver, latencyMs: Date.now() - t0 });
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error("[bridge]", lastError);
        return json({ error: lastError }, 502);
      } finally {
        busy = false;
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`[bridge] http://127.0.0.1:${PORT} → app ${APP} · driver: ${existsSync(OBU_REGISTRY) ? "Open Browser Use (your Chrome)" : "Playwright Chrome"}`);
