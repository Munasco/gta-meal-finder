# Contributing

Thanks for looking at this. The project is small on purpose; most changes touch one of a handful of files.

## Read this first

Review capacity is limited. Opening a PR does not create an obligation to review or merge it; we may close it, ask for a smaller scope, or do it differently later. Focused bug fixes, data corrections, reliability and performance work are the most likely to land. Unsolicited features, rewrites and drive-by cleanup are not.

- **Bugs and wrong data** go in [issues](https://github.com/Munasco/gta-meal-finder/issues/new/choose). Wrong scores, missing restaurants and broken menus are bugs.
- **Features and behaviour changes** start in [Ideas](https://github.com/Munasco/gta-meal-finder/discussions/categories/ideas). Get a maintainer's explicit OK on direction and scope before writing code, and link that comment in the PR. A linked discussion alone is not approval.
- **A small, obvious fix** needs neither. Say in the PR why it qualifies.

## One problem per PR

Solve one underlying problem, with the code, test and doc changes it needs and nothing else. Independent fixes get separate PRs, even when each is useful. Count problems, not linked issues.

## Show it works

Say how you established the problem, what you ran, and what you saw. "Tests pass" is not evidence. For scoring or ranking changes, include the query, the item and the numbers before and after. For UI changes, include before/after screenshots, or a short recording when motion matters. Upload evidence to the PR; never commit it.

## Triage

PRs get a `size:*` label automatically; it is context, not a rule. New issues get `needs-triage`. An issue labelled `needs more info` closes after 7 days without a reply and reopens on comment. Every closure names the reason and what would change it.

## Setup

```bash
git clone https://github.com/Munasco/gta-meal-finder && cd gta-meal-finder
npm install            # or bun install
cp .env.example .env.local   # optional: Azure keys for the intent model
npm run data:pull      # 43 MB dataset from Vercel Blob, verified by sha256
npm run dev            # http://localhost:5173
```

The app works with no keys. Add the Decision-1 keys to get model-based intent parsing and nutrition estimates; without them the heuristics take over and the UI says so.

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
| A new icon | use it as `lucide:<name>` or `simple-icons:<name>`, then `npm run icons` |

## Adding a biomarker lens

1. Add the id to `BiomarkerLensId` in `lib/models.ts`.
2. Add the lens (targets, direction, citations) to `lib/studies-and-lenses.ts`.
3. Teach `lib/intent.ts` to detect it (one line in the Decision-1 options plus a heuristic keyword list).
4. Add a label and icon in `lib/ui-meta.ts`.
