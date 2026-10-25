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

/** Rank dataset restaurants for a request; the app scores only what comes back. */
export function searchDataset(restaurants: DsRestaurant[], q: DatasetQuery): DsRestaurant[] {
  const norm = (v: string) => v.toLowerCase();
  const terms = q.terms.map(norm).filter((t) => t.length > 2);
  const hint = q.hint ? norm(q.hint).replace(/[^a-z0-9]/g, "") : null;
  const scored: { r: DsRestaurant; score: number; km: number | null }[] = [];
  for (const r of restaurants) {
    if (!r.items.length || /^view store$/i.test(r.restaurant.trim())) continue;
    const km = q.origin && r.geo ? haversineKm(q.origin, r.geo) : null;
    if (q.rangeKm !== undefined && km !== null && km > q.rangeKm) continue;
    const name = norm(r.restaurant);
    let score = 0;
    if (hint && name.replace(/[^a-z0-9]/g, "").includes(hint)) score += 50;
    for (const t of terms) {
      if (name.includes(t)) score += 6;
      let hits = 0;
      for (const i of r.items) {
        if (norm(i.name).includes(t)) hits += 1;
        else if (norm(i.description).includes(t)) hits += 0.3;
        if (hits >= 12) break;
      }
      score += Math.min(hits, 12);
    }
    if (km !== null) score += Math.max(0, 4 - km) * 0.5;
    if (score > 0 || terms.length === 0) scored.push({ r, score, km });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, q.limit).map(({ r }) => {
    const matches = (i: DsItem) => terms.reduce((n, t) => n + (norm(i.name).includes(t) ? 2 : norm(i.description).includes(t) ? 1 : 0), 0);
    const items = [...r.items].filter((i) => i.price !== null).sort((a, b) => matches(b) - matches(a)).slice(0, q.itemsPerRestaurant);
    return { restaurant: r.restaurant, storeUrl: r.storeUrl, rating: r.rating, address: r.address, promos: r.promos ?? [], geo: r.geo ?? null, items };
  });
}
