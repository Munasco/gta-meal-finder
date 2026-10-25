/**
 * Menus captured from the user's own browser (public/bridge.js).
 * Kept in isolate memory; survives HMR in dev via globalThis. Clear with DELETE /api/ingest.
 */
import { readEstimate, type ItemHealthEstimate } from "./health-estimate";

export interface IngestedItem {
  name: string;
  description: string;
  price: number | null;
  section: string | null;
  imageUrl: string | null;
  /** Uber Eats quick-view deep link for this item. */
  url: string | null;
  /** Calories as published on the Uber Eats menu (chains). */
  calories: number | null;
  likedPct: number | null;
  health: ItemHealthEstimate | null;
}

export interface IngestedRestaurant {
  restaurant: string;
  storeUrl: string | null;
  rating: number | null;
  address: string | null;
  items: IngestedItem[];
  promos: string[];
  geo: { lat: number; lng: number } | null;
  capturedAt: string;
}

export interface IngestPayload {
  source?: string;
  capturedAt?: string;
  pageUrl?: string;
  pl?: string | null;
  restaurants?: Partial<IngestedRestaurant>[];
}

type Store = { restaurants: Map<string, IngestedRestaurant>; pl: string | null };

const g = globalThis as unknown as { __mealFinderIngest?: Store };
const store: Store = (g.__mealFinderIngest ??= { restaurants: new Map(), pl: null });

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const decode = (v: string) => v.replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, " ");

function geoOf(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat ?? o.latitude);
  const lng = Number(o.lng ?? o.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function cleanItem(raw: unknown): IngestedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? decode(o.name).trim().slice(0, 120) : "";
  if (!name) return null;
  const price = typeof o.price === "number" && Number.isFinite(o.price) ? o.price : null;
  return {
    name,
    description: typeof o.description === "string" ? decode(o.description).trim().slice(0, 400) : "",
    price,
    section: typeof o.section === "string" && o.section ? o.section.slice(0, 80) : null,
    imageUrl: typeof o.imageUrl === "string" && /^https?:\/\//.test(o.imageUrl) ? o.imageUrl : null,
    url: typeof o.url === "string" && /^https:\/\/(www\.)?ubereats\.com\//.test(o.url) ? o.url.slice(0, 1500) : null,
    calories: typeof o.calories === "number" && o.calories > 0 && o.calories < 10000 ? Math.round(o.calories) : null,
    likedPct: typeof o.likedPct === "number" && o.likedPct >= 0 && o.likedPct <= 100 ? o.likedPct : null,
    health: readEstimate(o.health),
  };
}

/** Keep the worker small: bulk sources stay in the helper's dataset; only live captures are held here. */
const BULK_SOURCES = new Set(["crawl", "enrich", "dataset"]);
const MAX_RESTAURANTS = 40;
const MAX_ITEMS = 150;

export function ingest(payload: IngestPayload): { added: number; items: number } {
  let added = 0;
  let items = 0;
  if (typeof payload.pl === "string" && payload.pl.length < 2000) store.pl = payload.pl;
  if (payload.source && BULK_SOURCES.has(payload.source)) return { added: 0, items: 0 };
  for (const raw of payload.restaurants ?? []) {
    const name = typeof raw.restaurant === "string" ? decode(raw.restaurant).trim().slice(0, 120) : "";
    if (!name) continue;
    const promos = Array.isArray(raw.promos) ? raw.promos.filter((x): x is string => typeof x === "string").map(decode).slice(0, 5) : [];
    const cleaned = (raw.items ?? [])
      .map(cleanItem)
      .filter((i): i is IngestedItem => Boolean(i))
      .filter((i, idx, arr) => arr.findIndex((o) => o.name.toLowerCase() === i.name.toLowerCase() && o.price === i.price) === idx)
      .slice(0, MAX_ITEMS);
    const existing = store.restaurants.get(key(name));
    // A search-page capture (no items) must not wipe a menu captured earlier.
    if (cleaned.length === 0 && existing?.items.length) continue;
    store.restaurants.set(key(name), {
      restaurant: name,
      storeUrl: typeof raw.storeUrl === "string" && /^https?:\/\//.test(raw.storeUrl) ? raw.storeUrl : existing?.storeUrl ?? null,
      rating: typeof raw.rating === "number" ? raw.rating : existing?.rating ?? null,
      address: typeof raw.address === "string" ? raw.address : existing?.address ?? null,
      items: cleaned.length ? cleaned : existing?.items ?? [],
      promos: promos.length ? promos : existing?.promos ?? [],
      geo: geoOf(raw.geo) ?? existing?.geo ?? null,
      capturedAt: payload.capturedAt ?? new Date().toISOString(),
    });
    added++;
    items += cleaned.length;
  }
  // Evict the oldest captures beyond the cap.
  if (store.restaurants.size > MAX_RESTAURANTS) {
    const oldest = [...store.restaurants.entries()].sort((a, b) => a[1].capturedAt.localeCompare(b[1].capturedAt));
    for (const [k] of oldest.slice(0, store.restaurants.size - MAX_RESTAURANTS)) store.restaurants.delete(k);
  }
  return { added, items };
}

export function listIngested(): IngestedRestaurant[] {
  return [...store.restaurants.values()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function ingestedLocationParam(): string | null {
  return store.pl;
}

/** Uber's encoded delivery location (`pl` query param) pasted by the user. */
export function setLocationParam(pl: string | null): void {
  if (pl === null || (typeof pl === "string" && pl.length < 2000 && /^[A-Za-z0-9%=+/_-]+$/.test(pl))) store.pl = pl;
}

export function clearIngested(): void {
  store.restaurants.clear();
  store.pl = null;
}
