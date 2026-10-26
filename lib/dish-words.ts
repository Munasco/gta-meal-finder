import dishes from "../data/dish-words.json";

/**
 * Dish vocabulary: a canonical dish ("burger") and every way it shows up in queries and menu names
 * ("hamburger", "cheeseburger", "burgers"). Built from the dataset's own item names plus common
 * North American delivery dishes, so a plain "wings" or "pad thai" is understood as a dish.
 */
const GROUPS: Record<string, string[]> = dishes as Record<string, string[]>;

const esc = (v: string) => v.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
/** "fish and chips" also reads as "fish & chips" and "fish n chips"; any whitespace between words. */
const loose = (term: string) => esc(term).replace(/\s+and\s+/g, "\\s+(?:and|&|n'?)\\s+").replace(/\s+/g, "\\s+");

/** Every surface term with its group, longest first so "pad thai" is tried before "thai". */
const TERMS: { term: string; group: string; re: RegExp }[] = Object.entries(GROUPS)
  .flatMap(([group, terms]) => [...new Set([group, ...terms])].map((term) => ({ term, group })))
  .sort((a, b) => b.term.length - a.term.length)
  .map((t) => ({ ...t, re: new RegExp(`\\b${loose(t.term)}(?:e?s)?\\b`, "i") }));

/**
 * The dish a query names, as its canonical group ("chicken wings" → "wing", "a big cheeseburger" → "burger").
 * English puts the head noun last ("chicken burger" is a burger), so the dish mentioned last wins; a longer
 * term wins a tie ("caesar salad" over "salad"). Anything after "with"/"without"/"no" is a modifier, not the dish.
 */
export function parseDish(text: string): string | null {
  const head = text.split(/\b(?:with|without|w\/o|no)\b/i)[0];
  let best: { group: string; end: number; len: number } | null = null;
  for (const { term, group, re } of TERMS) {
    const m = re.exec(head);
    if (!m) continue;
    const end = m.index + m[0].length;
    if (!best || end > best.end || (end === best.end && term.length > best.len)) best = { group, end, len: term.length };
  }
  return best?.group ?? null;
}

const PATTERNS = new Map<string, RegExp>();

/** Matches any alias of the dish in menu text, as a word prefix so "burger" also hits "burgers". */
export function dishPattern(group: string): RegExp {
  let re = PATTERNS.get(group);
  if (!re) {
    const terms = [...new Set([group, ...(GROUPS[group] ?? [])])].sort((a, b) => b.length - a.length);
    re = new RegExp(`\\b(?:${terms.map(loose).join("|")})`, "i");
    PATTERNS.set(group, re);
  }
  return re;
}

/** True for a dish ("burger"), false for a cuisine word the parser fell back to ("mexican"). */
export const isDish = (word: string) => word in GROUPS;

export const DISH_GROUP_COUNT = Object.keys(GROUPS).length;
