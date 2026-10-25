# GTA Meal Finder

Type what you feel like eating, in plain words, and get delivery options across the Greater Toronto Area ranked by how well they fit **you**: a biomarker you're watching, a diet, a budget, a craving. Every dish shows a health score, a fit score, a Nutri-Score letter, a Harvard AHEI meal score and Health Canada "high in" warnings, plus the cheapest combo at each restaurant after BOGO deals.

Live: **https://gta-meal-finder.vercel.app**

> "healthy chicken for two under $40, I'm watching my sodium" → 20 restaurants, best combo per restaurant, every dish explained.

## Quick start

```bash
git clone https://github.com/Munasco/gta-meal-finder && cd gta-meal-finder
npm install              # or bun install
cp .env.example .env.local
npm run data:pull        # 43 MB crawl dataset from Vercel Blob, checksum-verified
npm run dev              # http://localhost:5173
```

That is a fully working app with **no API keys**: the dataset ships 549 restaurants and 54,821 menu items, 24,203 of them with nutrition estimates already computed. Add Decision-1 keys to `.env.local` when you want the model to read requests and estimate new items; without them the keyword heuristics run and the UI labels the result as such.

## How it works

```
request ─► intent ─► search ─► nutrition ─► score ─► combos ─► rank ─► UI
            │          │           │           │
            │          │           │           └─ lib/scoring-engine.ts  biomarker lens, baseline score
            │          │           │              lib/indices.ts         Nutri-Score, AHEI, Health Canada
            │          │           └─ lib/health-estimate.ts  USDA components picked by Decision-1
            │          └─ lib/dataset-search.ts   indexed in-process search (snapshot mode)
            │             bridge/server.ts        or a live Uber Eats search in your own Chrome
            └─ lib/intent.ts  Microsoft Decision-1 with heuristic fallback
```

1. **Intent.** `POST /api/find` sends the request text to Microsoft Decision-1 (Azure AI Foundry), a small decision model that returns a structured choice per dimension with a confidence: primary biomarker lens, diet, protein, taste, party size, calorie cap, wanted ingredients, value focus. Low-confidence fields fall back to keyword heuristics, so the app never blocks on the model.
2. **Search.** In snapshot mode the crawl dataset is loaded once per process, indexed once (lower-cased names and descriptions, non-restaurant stores dropped), and searched in about 5 ms. Without snapshot mode a local helper drives a real Chrome window on ubereats.com.
3. **Nutrition.** Menu items rarely publish nutrition. For each item, Decision-1 picks up to three USDA FoodData Central components (a protein, a base, a vegetable or side) with portion sizes; per-100 g values from USDA SR Legacy give calories, protein, fibre, sodium, sugars and saturated fat. The estimate is anchored to a calorie band so portion guesses can't run away. Items from chains with published nutrition use the verified catalogue instead.
4. **Score.** One engine scores verified and estimated dishes alike. The baseline is six components (protein density, fibre, whole foods; sodium, saturated fat, sugar). A biomarker lens (elevated bilirubin, high or low iron, MASLD, blood pressure, glycemic control, or general healthy) re-weights those components and adds "take more of / take less of" checks with citations.
5. **Indices.** The same nutrients feed three published systems so you can compare against labels you already know: Nutri-Score 2023 (A–E per 100 g), a meal-adapted Harvard AHEI (daily targets ÷ 3, scaled to 0–110) and Health Canada front-of-pack flags (15 % DV, 30 % for main dishes).
6. **Combos.** Per restaurant, the cheapest set of options that satisfies the party size and budget, with BOGO and promo math applied and tax and fees estimated, so the headline price is what you'd pay.
7. **Rank.** Restaurants are ordered by combo fit, then health, with the same brand collapsed to its nearest location.

## Why these choices

**Why a crawled snapshot instead of a live API?** Uber Eats has no public menu API and serves a verification page to server-side requests. The official MCP needs merchant OAuth and paid scrapers add cost and a credential to every deploy. A one-time crawl from 46 anchor points across the GTA (`data/gta-points.json`) gives a complete, reproducible dataset that is searchable in milliseconds, and a live mode still exists for development through your own browser. The trade-off is freshness: prices and promos are as of the crawl date in `data/manifest.json`.

**Why is the dataset on Vercel Blob and not in git?** Two JSON files total 43 MB and change wholesale on every re-crawl; in git they would bloat every clone forever. The files live in a public Blob store under content-addressed paths, `data/manifest.json` records URL and sha256, and `npm run build` pulls and verifies them before `next build`. Forks keep working off the published dataset, and `npm run data:push` moves a fork to its own store with one command.

**Why Microsoft Decision-1 instead of a general chat model?** The job is classification with confidence (which lens? which diet? how many people?), not generation. Decision-1 answers a fixed schema in one call, returns a confidence per field that the code can act on, and is cheap enough to run on every keystroke-sized request. The same model picks USDA components, which keeps nutrition estimates grounded in a real table instead of free-text calories.

**Why USDA components instead of asking a model for calories?** Models guess calories badly and inconsistently. Asking for *ingredients and grams* and looking up USDA SR Legacy values is auditable: every estimate can show which components it assumed, and swapping one changes the number predictably. The 71 components in `data/usda-components.json` cover most delivery menus.

**Why one scoring engine for verified and estimated dishes?** So that a verified Freshii bowl and an estimated shawarma plate are compared on the same scale and the same lens rules, with the estimate clearly labelled rather than silently ranked differently.

**Why three public indices on top of our own score?** Our score is tuned to a biomarker lens; Nutri-Score, AHEI and Health Canada are what people already see on packaging and in guidelines. Showing all of them, each with its method in a tooltip, makes the ranking checkable instead of a black box. All three are computed from the same nutrients and flagged "estimated" when the inputs are.

**Why Next.js on Vercel?** The whole backend is a handful of route handlers that need Node (filesystem for the snapshot, `fetch` with timeouts). Vercel builds the app with the dataset included through `outputFileTracingIncludes`, so a search never leaves the function instance. Fluid Compute keeps the parsed dataset warm across requests. No database, no queue.

**Why shadcn + Tailwind and Iconify?** The UI is mostly dense lists with tooltips; shadcn primitives are vendored into `components/ui` so they can be read and changed without a dependency upgrade. Icons come from Iconify (Lucide and Simple Icons) and are **bundled at build time** into `components/generated-icons.ts`: the page makes zero requests to an icon CDN and icons render during server-side rendering. `npm run lint` fails if the bundle drifts from the icons used in code.

**Why self-hosted Inter?** One fewer render-blocking request and no third-party font CSS; `@fontsource-variable/inter` ships the variable font with the app.

**Why Bun for the crawl scripts and tests but npm for the app?** The crawl and enrichment scripts use Bun's file APIs and run for hours on a laptop, and `bun test` runs the TypeScript test files without a build step; nothing in production depends on Bun. The app itself builds with plain Node so Vercel and CI need no extra runtime.

**Why a local Chrome helper for live mode?** The only reliable way to read Uber Eats menus is as a logged-in browser. `bridge/server.ts` drives your own Chrome (Open Browser Use first, Playwright as fallback), so no credentials ever reach the server, and `public/bridge.js` can post menus you browse yourself back into the app.

## Project layout

```
app/
  page.tsx                 the single-page UI (search panel, results, map, developer view)
  api/find/route.ts        main endpoint: intent → search → score → combos
  api/decision/route.ts    intent only (debugging the model)
  api/mcp/route.ts         read-only MCP server (search_meals, compare_meals, get_biomarker_guidelines…)
  api/ingest/route.ts      receives menus captured by public/bridge.js
  api/doordash/route.ts    optional DoorDash Drive quote
components/meal/           restaurant card, option sheet, indices panel, composer, maps, settings
components/ui/             vendored shadcn primitives (don't edit)
components/icon.tsx        Iconify with the offline bundle registered
lib/
  intent.ts                Decision-1 call, memo, timeout, heuristic fallbacks
  uber-eats.ts             providers, evaluation, combos, BOGO math, wire-format slimming
  scoring-engine.ts        baseline score and biomarker-lens adjustments
  studies-and-lenses.ts    lens definitions with citations
  indices.ts               Nutri-Score, AHEI, Health Canada
  health-estimate.ts       USDA-component nutrition estimates
  dataset-search.ts        one-time index + search over the crawl dataset
  dataset-local.ts         snapshot loading (DATASET_LOCAL=1)
  gta-catalogue.ts         verified dishes from chains that publish nutrition
bridge/                    Bun scripts: live helper, crawler, enrichment, cleanup
data/                      manifest.json, anchor points, USDA table (crawl JSON is pulled, not committed)
scripts/                   dataset.mjs (pull/push), bundle-icons.mjs
launch-video/              Remotion launch film (separate package, not part of the app build)
tests/                     node:test suites
```

## API

```bash
curl -X POST https://gta-meal-finder.vercel.app/api/find \
  -H 'Content-Type: application/json' \
  -d '{"query":"low sodium salmon for 2 under $50","address":"200 Bay St, Toronto"}'
```

The response carries the parsed intent, restaurant groups with scored options, each option's indices and evaluation, and the combo per restaurant. `GET /api/find` returns provider status and dataset stats.

MCP: `claude mcp add gta-meals --transport http https://gta-meal-finder.vercel.app/api/mcp`

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `DATASET_LOCAL` | `1` searches the pulled dataset in-process | unset (live helper) |
| `AZURE_DECISION_ENDPOINT`, `AZURE_DECISION_KEY`, `AZURE_DECISION_DEPLOYMENT` | Microsoft Decision-1 | heuristics |
| `GOOGLE_MAPS_API_KEY` | Google Maps picker | OpenStreetMap |
| `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` | DoorDash Drive quotes | off |
| `BLOB_READ_WRITE_TOKEN` | `npm run data:push` only | — |
| `DATASET_BASE_URL` | pull from another Blob store | manifest |
| `BRIDGE_URL`, `BRIDGE_PORT`, `BRIDGE_DRIVER`, `BRIDGE_HEADLESS` | local Chrome helper | `127.0.0.1:5174`, auto |

Keys live only in `.env.local` locally and in encrypted Vercel environment variables in production. Nothing in the repo or the client bundle contains a key.

## Deploy your own

1. Fork, then `vercel link` (or import the repo in the Vercel dashboard).
2. `vercel env add DATASET_LOCAL` with value `1` for Production and Preview; add the Decision-1 variables if you have them.
3. `vercel --prod`. The build pulls the dataset from the public manifest, bundles the icons and runs `next build`.

To use your own dataset, re-crawl (below), create a public Blob store in your project, `npm run data:push`, commit `data/manifest.json`, redeploy.

## Re-crawling

Needs Bun and Chrome. The crawler searches ~40 cuisine queries from each anchor point, opens every store page and records menu, prices, promos and coordinates, resuming per point if interrupted.

```bash
bun install
npm run crawl                       # hours; writes data/ubereats-gta.json
npm run crawl -- --revisit          # fill stores missing address or coordinates
npm run clean                       # drop grocery / convenience / retail rows
npm run enrich -- --concurrency 6   # Decision-1 + USDA estimates → data/health-estimates.json
npm run data:push                   # upload to your Blob store, rewrite the manifest
```

## Development

```bash
npm run dev          # Next dev server on :5173 (the port the live helper and bridge.js expect)
npm run bridge       # optional: live Uber Eats helper on :5174 (unset DATASET_LOCAL to use it)
npm run check        # lint + icon-bundle check + typecheck + tests
npm run icons        # regenerate components/generated-icons.ts after using a new icon
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for where to make common changes and how to add a biomarker lens.

## Data and health disclaimer

Nutrition values for most dishes are **estimates** from menu text and USDA reference foods, labelled as such in the UI. Lens guidance summarises published studies (cited in `lib/studies-and-lenses.ts`) and is not medical advice. Menu data belongs to the respective restaurants and Uber Eats; this project indexes it for personal use.

## License

[MIT](LICENSE)
