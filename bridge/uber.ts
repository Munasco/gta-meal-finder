/** Shared Uber Eats browsing code for bridge/server.ts and bridge/crawl.ts. */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectOpenBrowserUse, type OpenBrowserUseBrowser, type OpenBrowserUseTab } from "open-browser-use-sdk";
import { chromium, type BrowserContext, type Page } from "playwright";

export const PROFILE = path.resolve(process.env.BRIDGE_PROFILE ?? ".bridge-profile");
export const HEADLESS = process.env.BRIDGE_HEADLESS === "1";
export const OBU_REGISTRY = "/tmp/open-browser-use/active.json";
const CACHE_MS = 10 * 60 * 1000;

export interface Item { name: string; description: string; price: number | null; section: string | null; imageUrl: string | null; url?: string | null; calories?: number | null; likedPct?: number | null }
export interface Restaurant { restaurant: string; storeUrl: string | null; rating: number | null; address: string | null; items: Item[]; promos?: string[]; geo?: { lat: number; lng: number } | null; schemaType?: string | null }
export interface StoreLink { name: string; url: string; promos: string[] }

export const cache = new Map<string, { at: number; restaurants: Restaurant[] }>();
export const state: { activeDriver: "obu" | "playwright" | null; obuConnected: boolean; pwConnected: boolean } = { activeDriver: null, obuConnected: false, pwConnected: false };

/* ----------------------------- page-side code ----------------------------- */
/* These run inside the browser page. They must stay self-contained. */

function extractMenu(): Restaurant[] {
  const price = (v: unknown): number | null => {
    if (typeof v === "number") return v;
    const m = String(v ?? "").replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    return m ? Number(m[1]) : null;
  };
  const text = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? "").trim();
  const out: Restaurant[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    let data: unknown;
    try { data = JSON.parse(s.textContent ?? ""); } catch { return; }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes as Record<string, unknown>[]) {
      if (!node || typeof node !== "object") continue;
      const menu = (node.hasMenu as Record<string, unknown> | undefined) ?? (node["@type"] === "Menu" ? node : undefined);
      if (!menu) continue;
      const items: Item[] = [];
      for (const sec of ([] as Record<string, unknown>[]).concat((menu.hasMenuSection as Record<string, unknown>[]) ?? [])) {
        for (const it of ([] as Record<string, unknown>[]).concat((sec.hasMenuItem as Record<string, unknown>[]) ?? [])) {
          if (!it?.name) continue;
          const offer = (Array.isArray(it.offers) ? it.offers[0] : it.offers) as Record<string, unknown> | undefined;
          items.push({
            name: String(it.name).trim(),
            description: String(it.description ?? "").trim(),
            price: price(offer?.price ?? offer?.lowPrice),
            section: String(sec.name ?? "").trim() || null,
            imageUrl: typeof it.image === "string" ? it.image : null,
          });
        }
      }
      if (items.length) {
        const addr = node.address as Record<string, unknown> | undefined;
        const geo = node.geo as Record<string, unknown> | undefined;
        out.push({
          schemaType: typeof node["@type"] === "string" ? (node["@type"] as string) : null,
          geo: geo && Number.isFinite(Number(geo.latitude)) ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : null,
          restaurant: String(node.name ?? text(document.querySelector("h1")) ?? "Restaurant").trim(),
          storeUrl: location.href.split("?")[0],
          rating: node.aggregateRating ? price((node.aggregateRating as Record<string, unknown>).ratingValue) : null,
          address: addr && typeof addr === "object" ? [addr.streetAddress, addr.addressLocality].filter(Boolean).join(", ") : null,
          items,
        });
      }
    }
  });
  // Uber's item cards: quick-view deep link, published calories (chains) and "% liked".
  const cards = new Map<string, { url: string; calories: number | null; likedPct: number | null; price: number | null }>();
  document.querySelectorAll<HTMLAnchorElement>('a[href*="quickView"]').forEach((a) => {
    const lines = ((a as HTMLElement).innerText ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines.find((l) => !/^#\d+ most liked|^\$|Cal\.|^\d+%/i.test(l));
    if (!name) return;
    const all = lines.join(" ");
    const cal = all.match(/(\d{2,4})\s*Cal/i);
    const liked = all.match(/(\d{1,3})%\s*\(/);
    const pr = all.match(/\$\s?(\d+(?:\.\d{2})?)/);
    const key = name.toLowerCase();
    if (!cards.has(key)) cards.set(key, { url: a.href, calories: cal ? Number(cal[1]) : null, likedPct: liked ? Number(liked[1]) : null, price: pr ? Number(pr[1]) : null });
  });
  const attach = (it: Item) => {
    const c = cards.get(it.name.toLowerCase());
    if (!c) return it;
    return { ...it, url: c.url, calories: c.calories, likedPct: c.likedPct, price: it.price ?? c.price };
  };
  for (const r of out) r.items = r.items.map(attach);
  if (out.length) return out;

  // DOM fallback: leaf price nodes → nearest card with exactly one price
  const seen = new Set<string>();
  const items: Item[] = [];
  document.body.querySelectorAll("span, div, p").forEach((el) => {
    if (el.children.length) return;
    const t = text(el);
    if (!/^(CA)?\$\s?\d+(\.\d{2})?$/.test(t)) return;
    let card: Element = el;
    for (let hops = 0; card.parentElement && hops < 8; hops++) {
      card = card.parentElement;
      const prices = text(card).match(/\$\s?\d+(\.\d{2})?/g) ?? [];
      if (prices.length === 1 && text(card).length > t.length + 3) break;
    }
    const lines = text(card).split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines.find((l) => !/^(CA)?\$/.test(l) && l.length > 2 && l.length < 90);
    if (!name || seen.has(name)) return;
    seen.add(name);
    items.push({ name, description: lines.find((l) => l !== name && !/^(CA)?\$/.test(l)) ?? "", price: price(t), section: null, imageUrl: null });
  });
  return items.length
    ? [{ restaurant: text(document.querySelector("h1")) || document.title.replace(/\s*\|.*$/, ""), storeUrl: location.href.split("?")[0], rating: null, address: null, items: items.map(attach) }]
    : [];
}

function collectStores(): StoreLink[] {
  const byUrl = new Map<string, StoreLink & { fromSlug: boolean }>();
  const PROMO = /buy \d+,? get \d+|\bbogo\b|\d+% off|\$\d+ off|free (delivery|item)|2 for 1|offers?\b/i;
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/store/"]').forEach((a) => {
    const url = a.href.split("?")[0];
    const fromText = ((a as HTMLElement).innerText ?? "").split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
    const fromHeading = ((a.querySelector("h1,h2,h3,h4") as HTMLElement | null)?.innerText ?? "").trim();
    const slugPart = decodeURIComponent(url.split("/store/")[1]?.split("/")[0] ?? "").replace(/-/g, " ").trim();
    const fromSlug = !fromText && !fromHeading;
    const name = fromText || fromHeading || slugPart.replace(/\b\w/g, (c) => c.toUpperCase());
    if (!name) return;
    // Promo tags ("Buy 1, get 1", "20% off") sit next to the store name in the same card.
    const cardLines = ((a.parentElement as HTMLElement | null)?.innerText ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const promos = [...new Set(cardLines.filter((l) => PROMO.test(l) && l.length < 60 && !/uber one/i.test(l)))];
    const existing = byUrl.get(url);
    if (!existing) byUrl.set(url, { name, url, promos, fromSlug });
    else {
      if (existing.fromSlug && !fromSlug) { existing.name = name; existing.fromSlug = false; }
      for (const pr of promos) if (!existing.promos.includes(pr)) existing.promos.push(pr);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip the helper flag
  return [...byUrl.values()].map(({ fromSlug: _f, ...rest }) => rest);
}

function pageState(): { title: string; stores: number; ld: number } {
  let named = 0;
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/store/"]').forEach((a) => {
    if (((a as HTMLElement).innerText ?? "").trim()) named++;
  });
  return {
    title: document.title,
    stores: named,
    ld: document.querySelectorAll('script[type="application/ld+json"]').length,
  };
}

export const EXPR_EXTRACT = `(${extractMenu.toString()})()`;
export const EXPR_STORES = `(${collectStores.toString()})()`;
export const EXPR_STATE = `(${pageState.toString()})()`;

/* ------------------------------- a tiny driver API ------------------------ */

export interface Driver {
  name: "obu" | "playwright";
  open(url: string): Promise<Handle>;
}
export interface Handle {
  goto(url: string): Promise<void>;
  evaluate<T>(expr: string): Promise<T>;
  close(): Promise<void>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until past any verification page and the predicate holds. */
export async function settle(h: Handle, ready: (s: { title: string; stores: number; ld: number }) => boolean, ms: number) {
  const t0 = Date.now();
  let warned = false;
  while (Date.now() - t0 < ms) {
    const s = await h.evaluate<{ title: string; stores: number; ld: number }>(EXPR_STATE).catch(() => ({ title: "", stores: 0, ld: 0 }));
    const blocked = /just a moment|attention required|access denied|verify you are human/i.test(s.title);
    if (!blocked && ready(s)) return;
    if (blocked && !warned) {
      console.log("[bridge] Uber Eats is showing a verification page. Complete it in Chrome if asked.");
      warned = true;
    }
    await sleep(750);
  }
}

/** Uber renders item cards lazily; scroll the whole page once so links and calories are all present. */
export async function scrollThrough(h: Handle, maxSteps = 14) {
  let last = -1;
  for (let i = 0; i < maxSteps; i++) {
    const y = await h.evaluate<number>("(() => { window.scrollBy(0, 1600); return window.scrollY; })()").catch(() => -1);
    await sleep(220);
    if (y === last || y < 0) break;
    last = y;
  }
  await h.evaluate("window.scrollTo(0, 0)").catch(() => undefined);
  await sleep(300);
}

/* obu: your real Chrome profile through the Open Browser Use extension */
let obuBrowser: OpenBrowserUseBrowser | null = null;

async function obuDriver(): Promise<Driver> {
  if (!obuBrowser) {
    const { socketPath } = JSON.parse(await readFile(OBU_REGISTRY, "utf8")) as { socketPath: string };
    const sessionId = process.env.OBU_SESSION ?? "meal-finder";
    obuBrowser = await connectOpenBrowserUse({ socketPath, sessionId, timeoutMs: 30_000 });
    await obuBrowser.client.nameSession(sessionId === "meal-finder" ? "Meal Finder" : `Meal Finder · ${sessionId}`).catch(() => undefined);
  }
  const browser = obuBrowser;
  return {
    name: "obu",
    async open(url) {
      let tab: OpenBrowserUseTab = await browser.newTab({ url, waitUntil: "domcontentloaded", timeoutMs: 60_000 });
      return {
        async goto(next) {
          await tab.goto(next, { waitUntil: "domcontentloaded", timeoutMs: 60_000 });
        },
        async evaluate<T>(expr: string) {
          return (await tab.evaluate(expr)) as T;
        },
        async close() {
          await tab.close().catch(() => undefined);
          tab = null as unknown as OpenBrowserUseTab;
        },
      };
    },
  };
}

/* playwright: a Chrome window with its own persistent profile */
let pwContext: BrowserContext | null = null;

async function playwrightDriver(): Promise<Driver> {
  if (!pwContext) {
    const exe = process.env.BRIDGE_CHROME_PATH;
    const opts = exe
      ? { executablePath: exe }
      : existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        ? { channel: "chrome" as const }
        : {};
    pwContext = await chromium.launchPersistentContext(PROFILE, { headless: HEADLESS, viewport: { width: 1280, height: 900 }, locale: "en-CA", ...opts });
    pwContext.on("close", () => {
      pwContext = null;
    });
  }
  const ctx = pwContext;
  return {
    name: "playwright",
    async open(url) {
      const page: Page = await ctx.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return {
        async goto(next) {
          await page.goto(next, { waitUntil: "domcontentloaded", timeout: 60_000 });
        },
        async evaluate<T>(expr: string) {
          return (await page.evaluate(expr)) as T;
        },
        async close() {
          await page.close().catch(() => undefined);
        },
      };
    },
  };
}

export async function getDriver(): Promise<Driver> {
  const forced = process.env.BRIDGE_DRIVER;
  if (forced !== "playwright" && existsSync(OBU_REGISTRY)) {
    try {
      const d = await obuDriver();
      state.activeDriver = "obu"; state.obuConnected = true;
      return d;
    } catch (e) {
      obuBrowser = null;
      console.warn(`[bridge] Open Browser Use unavailable (${e instanceof Error ? e.message : e}); falling back to Playwright`);
      if (forced === "obu") throw e;
    }
  }
  const d = await playwrightDriver();
  state.activeDriver = "playwright"; state.pwConnected = true;
  return d;
}

/* --------------------------------- search --------------------------------- */

export async function search(query: string, pl: string | null, maxStores: number, prefer: string | null): Promise<Restaurant[]> {
  const key = `${query}|${pl ?? ""}|${maxStores}|${prefer ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.restaurants;

  const driver = await getDriver();
  const url = `https://www.ubereats.com/ca/search?q=${encodeURIComponent(query)}${pl ? `&pl=${encodeURIComponent(pl)}` : ""}`;
  console.log(`[bridge:${driver.name}] search ${url}`);
  const h = await driver.open(url);
  try {
    await settle(h, (s) => s.stores >= 3, 45_000);
    await sleep(1000); // let the result grid finish rendering
    const all = await h.evaluate<StoreLink[]>(EXPR_STORES);
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const wanted = prefer ? norm(prefer) : "";
    const preferred = wanted ? all.filter((s) => norm(s.name).includes(wanted)) : [];
    const rest = all.filter((s) => !preferred.includes(s));
    const stores = [...preferred, ...rest].slice(0, maxStores);
    console.log(`[bridge] ${stores.length} stores: ${stores.map((s) => s.name).join(" · ")}`);

    const restaurants: Restaurant[] = [];
    for (const store of stores) {
      try {
        await h.goto(store.url);
        await settle(h, (s) => s.ld > 0, 20_000);
        await scrollThrough(h);
        const found = await h.evaluate<Restaurant[]>(EXPR_EXTRACT);
        for (const r of found) {
          if (r.schemaType && !/Restaurant|FoodEstablishment|Cafe|Bar/i.test(r.schemaType)) continue;
          restaurants.push({ ...r, storeUrl: store.url, restaurant: r.restaurant || store.name, promos: store.promos });
        }
        console.log(`[bridge] ${store.name}: ${found.reduce((n, r) => n + r.items.length, 0)} items`);
      } catch (e) {
        console.warn(`[bridge] ${store.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
    cache.set(key, { at: Date.now(), restaurants });
    return restaurants;
  } finally {
    await h.close();
  }
}

