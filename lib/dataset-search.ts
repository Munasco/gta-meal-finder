/**
 * Search over the crawl dataset (restaurants with menus, promos, geo, health estimates).
 * Pure functions, shared by the local helper (bridge/server.ts) and the Vercel build, which bundles the
 * dataset files and searches them in-process.
 */
export interface DsItem {
  name: string;
  description: string;
  price: number | null;
  section: string | null;
  url?: string | null;
  calories?: number | null;
  likedPct?: number | null;
  health?: unknown;
}
import { isNonRestaurantName } from "./store-filter";

export interface DsRestaurant {
  restaurant: string;
  storeUrl: string | null;
  rating: number | null;
  address: string | null;
  promos?: string[];
  geo?: { lat: number; lng: number } | null;
  items: DsItem[];
}

export interface DatasetQuery {
  terms: string[];
  hint: string | null;
  origin?: { lat: number; lng: number };
  rangeKm?: number;
  limit: number;
  itemsPerRestaurant: number;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Attach estimates (keyed "restaurant|item", lower-cased) to dataset items. */
export function mergeEstimates(restaurants: DsRestaurant[], estimates: Record<string, unknown>) {
  for (const r of restaurants) for (const i of r.items) i.health = estimates[`${r.restaurant.trim().toLowerCase()}|${i.name.trim().toLowerCase()}`] ?? null;
  return restaurants;
}

interface IndexedItem {
  item: DsItem;
  name: string;
  desc: string;
  priced: boolean;
}

interface IndexedRestaurant {
  r: DsRestaurant;
  name: string;
  /** Letters and digits only, for restaurant-hint matching ("nandos" ~ "Nando's"). */
  key: string;
  items: IndexedItem[];
}

const INDEX = new WeakMap<DsRestaurant[], IndexedRestaurant[]>();

/**
 * Lower-cased search text per restaurant and item, built once per dataset array instead of on every
 * request (55k items × every term). Non-restaurant stores are dropped here; unpriced items still count
 * toward a restaurant's match but are never returned.
 */
export function indexDataset(restaurants: DsRestaurant[]): IndexedRestaurant[] {
  let idx = INDEX.get(restaurants);
  if (idx) return idx;
  idx = [];
  for (const r of restaurants) {
    if (!r.items.length || isNonRestaurantName(r.restaurant)) continue;
    const name = r.restaurant.toLowerCase();
    const items = r.items.map((item) => ({ item, name: item.name.toLowerCase(), desc: item.description.toLowerCase(), priced: item.price !== null }));
    idx.push({ r, name, key: name.replace(/[^a-z0-9]/g, ""), items });
  }
  INDEX.set(restaurants, idx);
  return idx;
}

/** Rank dataset restaurants for a request; the app scores only what comes back. */
export function searchDataset(restaurants: DsRestaurant[], q: DatasetQuery): DsRestaurant[] {
  const terms = q.terms.map((t) => t.toLowerCase()).filter((t) => t.length > 2);
  const hint = q.hint ? q.hint.toLowerCase().replace(/[^a-z0-9]/g, "") : null;
  const scored: { ix: IndexedRestaurant; score: number }[] = [];
  for (const ix of indexDataset(restaurants)) {
    const { r } = ix;
    const km = q.origin && r.geo ? haversineKm(q.origin, r.geo) : null;
    if (q.rangeKm !== undefined && km !== null && km > q.rangeKm) continue;
    let score = 0;
    if (hint && ix.key.includes(hint)) score += 50;
    for (const t of terms) {
      if (ix.name.includes(t)) score += 6;
      let hits = 0;
      for (const i of ix.items) {
        if (i.name.includes(t)) hits += 1;
        else if (i.desc.includes(t)) hits += 0.3;
        if (hits >= 12) break;
      }
      score += Math.min(hits, 12);
    }
    if (km !== null) score += Math.max(0, 4 - km) * 0.5;
    if (score > 0 || terms.length === 0) scored.push({ ix, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, q.limit).map(({ ix }) => {
    const { r } = ix;
    const matches = (i: IndexedItem) => terms.reduce((n, t) => n + (i.name.includes(t) ? 2 : i.desc.includes(t) ? 1 : 0), 0);
    const items = ix.items.filter((i) => i.priced).sort((a, b) => matches(b) - matches(a)).slice(0, q.itemsPerRestaurant).map((i) => i.item);
    return { restaurant: r.restaurant, storeUrl: r.storeUrl, rating: r.rating, address: r.address, promos: r.promos ?? [], geo: r.geo ?? null, items };
  });
}
