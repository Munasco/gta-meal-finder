# Eat Healthier

Type what you feel like eating, in plain words, and get delivery options across the Greater Toronto Area ranked by how well they fit **you**: a biomarker you're watching, a diet, a budget, a craving. Every dish gets a health score, a Nutri-Score letter, a Harvard AHEI meal score and Health Canada "high in" warnings, plus the cheapest combo at each restaurant after BOGO deals.

Live: **https://eat-healthier.vercel.app**

> "healthy chicken for two under $40, I'm watching my sodium" → 20 restaurants, best combo per restaurant, every dish explained.

## Quick start

```bash
git clone https://github.com/Munasco/gta-meal-finder && cd gta-meal-finder
npm install
npm run data:pull        # 43 MB dataset, checksum-verified
npm run dev              # http://localhost:5173
```

That is the whole app, with no keys: 549 restaurants, 54,821 menu items, 24,203 of them with nutrition estimates. Add the Azure Decision-1 keys from `.env.example` to `.env.local` when you want the model to read requests and estimate new items; without them keyword heuristics run and the UI says so.

## How it works

1. **Understand.** A small decision model turns the request into a lens, diet, protein, party size, budget and cravings, each with a confidence. Low-confidence fields fall back to keywords, so the app never blocks on the model.
2. **Search.** The dataset is indexed once per process and searched in about 5 ms.
3. **Estimate.** Menu items rarely publish nutrition. The model picks up to three USDA reference foods with portions, and their per-100 g values give calories, protein, fibre, sodium, sugar and saturated fat. Chains that publish nutrition use their verified numbers.
4. **Score.** One engine scores every dish: protein, fibre and whole foods count up; sodium, saturated fat and sugar count down. A biomarker lens (bilirubin, iron, MASLD, blood pressure, glycemic control, general healthy) re-weights those and adds cited take-more / take-less checks.
5. **Cross-check.** The same nutrients feed Nutri-Score 2023, a meal-adapted Harvard AHEI and Health Canada front-of-pack flags, so you can compare against labels you already know.
6. **Rank.** Restaurants are ordered by the cheapest combo that fits the party and budget after BOGO and promo math, then by health, with each brand collapsed to its nearest location.

## Why

- **A decision model, not a chat model.** The job is classification with confidence, not generation. One call, a fixed schema, a confidence per field the code can act on.
- **USDA reference foods, not model calories.** Models guess calories badly. Asking for foods and grams and looking up real values is auditable: every estimate can show what it assumed.
- **One score for verified and estimated dishes.** They are compared on the same scale with the same lens rules; the estimate is labelled, not ranked differently.
- **Dataset outside git.** The two JSON files are 43 MB and change wholesale; `data/manifest.json` records where they live and their checksums, and the build pulls and verifies them.

## Layout

```
app/           single-page UI and route handlers (/api/find, /api/decision, /api/mcp)
components/    UI; shadcn primitives are vendored in components/ui
lib/           intent, dataset search, nutrition estimates, scoring engine, lenses, indices, combos
data/          manifest.json and the USDA reference table
scripts/       dataset pull, enrichment, icon bundle
tests/         bun test suites
```

## API

```bash
curl -X POST https://eat-healthier.vercel.app/api/find \
  -H 'Content-Type: application/json' \
  -d '{"query":"low sodium salmon for 2 under $50","address":"200 Bay St, Toronto"}'
```

MCP: `claude mcp add gta-meals --transport http https://eat-healthier.vercel.app/api/mcp`

## Configuration

| Variable | Purpose |
|---|---|
| `AZURE_DECISION_ENDPOINT`, `AZURE_DECISION_KEY`, `AZURE_DECISION_DEPLOYMENT` | Decision model for request reading and nutrition estimates; keyword fallback without it |
| `GOOGLE_MAPS_API_KEY` | Google Maps delivery-point picker; OpenStreetMap without it |

Keys live in `.env.local` locally and in Vercel environment variables in production. Nothing in the repo or the client bundle contains a key.

## Development

```bash
npm run check        # lint + icon-bundle check + typecheck + tests
npm run icons        # regenerate the icon bundle after using a new icon
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for where things live and how to add a biomarker lens.

## Disclaimer

Nutrition values for most dishes are **estimates** from menu text and USDA reference foods, labelled as such in the UI. Lens guidance summarises published studies (cited in `lib/studies-and-lenses.ts`) and is not medical advice. Menu data belongs to the respective restaurants and Uber Eats.

## License

[MIT](LICENSE)
