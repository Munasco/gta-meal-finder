# Contributing

Thanks for looking at this. The project is small on purpose; most changes touch one of a handful of files.

## Setup

```bash
git clone https://github.com/Munasco/gta-meal-finder && cd gta-meal-finder
npm install            # or bun install
cp .env.example .env.local
npm run data:pull      # 43 MB of crawl data from Vercel Blob, verified by sha256
npm run dev            # http://localhost:5173
```

`DATASET_LOCAL=1` (set in `.env.example`) searches the downloaded dataset in-process, so the app works with no keys and no browser automation. Add the Decision-1 keys to get model-based intent parsing and nutrition estimates; without them the heuristics take over and the UI says so.

## Before you open a pull request

```bash
npm run check          # lint (incl. icon bundle drift) + typecheck + tests (tests run with bun)
```

CI runs the same three steps plus `npm run build`. Keep commits in the imperative mood ("Add sodium cap to intent"), with no sign-off or generated-by trailers.

## Where things live

| Want to change… | Edit |
|---|---|
| How a request is understood (lens, diet, budget, portions) | `lib/intent.ts` (Decision-1 schema and the heuristic fallbacks live side by side) |
| How a dish is scored | `lib/scoring-engine.ts`, lens definitions and citations in `lib/studies-and-lenses.ts` |
| Nutri-Score, AHEI, Health Canada flags | `lib/indices.ts` |
| Nutrition estimates for menu items | `lib/health-estimate.ts`, USDA table in `data/usda-components.json` |
| Ranking, combos, BOGO math, provider order | `lib/uber-eats.ts` |
| Dataset search and indexing | `lib/dataset-search.ts` |
| The UI | `app/page.tsx` and `components/meal/*` (shadcn primitives in `components/ui` are vendored, don't edit them) |
| Crawling or re-crawling | `bridge/crawl.ts`, anchor points in `data/gta-points.json` |
| A new icon | use it as `lucide:<name>` or `simple-icons:<name>`, then `npm run icons` |

## Adding a biomarker lens

1. Add the id to `BiomarkerLensId` in `lib/models.ts`.
2. Add the lens (targets, direction, citations) to `lib/studies-and-lenses.ts`.
3. Teach `lib/intent.ts` to detect it (one line in the Decision-1 options plus a heuristic keyword list).
4. Add a label and icon in `lib/ui-meta.ts`.

## Re-crawling the dataset

Crawling drives your own Chrome against Uber Eats and takes hours; see the README. When done:

```bash
npm run clean && npm run enrich -- --concurrency 6
vercel blob create-store my-meal-data --access public --yes   # once, in your own Vercel project
vercel env pull
npm run data:push                                              # uploads, rewrites data/manifest.json
```

Commit the manifest, not the JSON files.
