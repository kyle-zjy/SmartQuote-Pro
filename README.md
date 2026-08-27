# SmartQuote Pro

React + TypeScript quoting tool for GOLDCO Security Group's supply & install price list
(`documents/Supply & Install (17-5-26).xlsx`).

## Getting started

```bash
npm install
npm run dev
```

Build for production with `npm run build`.

## How pricing data flows

The price matrices live in the source Excel file, not in the app. `scripts/generate-pricing-data.py`
reads the workbook and writes `src/data/pricing.json` and `src/data/addons.json`, which the frontend
imports directly as the default/bundled price list. All prices are rounded to whole dollars.

When the price list is updated, regenerate the data:

```bash
pip install openpyxl
python scripts/generate-pricing-data.py
python scripts/generate-colours.py
```

### Importing an updated price list from the browser

The Home page also has a drag-and-drop zone that lets a user load a newer version of the price list
xlsx directly in the browser, without rebuilding the app. `src/lib/xlsxImport.ts` is a TypeScript port
of the same extraction algorithm as `scripts/generate-pricing-data.py` (kept in sync manually), so the
uploaded file **must use the same template** — same sheet names, same title text, same matrix/extras
layout — only the numbers are expected to change. Imported data is held in memory only
(`src/lib/pricingContext.tsx`, not persisted to `localStorage`), so refreshing the page reverts to the
bundled default. `documents/Supply & Install (TEST - updated prices).xlsx` is a same-template copy
with prices bumped ~10% and dates shifted, generated for exercising this import path.

Backend handoff: Chinese teammate brief `docs/backend-handoff-zh.md`; English contract `docs/backend-api-and-schema.md`.

## Backend (server/)

A minimal Postgres-backed API skeleton lives in `server/` — catalog data only (products,
addons, colours, company settings). It does not replace the frontend's bundled JSON yet;
see `docs/backend-handoff-zh.md` for the full contract this is building toward.

```bash
docker compose up -d                 # starts Postgres on localhost:5432
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates tables
npx prisma db seed                   # loads src/data/*.json + company settings
npm run dev                          # http://localhost:3001
```

Then check `curl localhost:3001/api/v1/products`, `/addons`, `/colours`, `/company`, and
`/health`. Quote/customer CRUD, auth, and room photos are not implemented yet.

`staff_users` exists in the schema (so `quotes.createdBy` has a target once login lands) but
nothing seeds or writes to it yet — there is no login flow. Quote numbers are meant to be
allocated from a Postgres sequence, `quote_number_seq` (starts at `33021`, continuing on from
the frontend's old client-side counter), not generated in the browser; see the comment above
`CREATE SEQUENCE quote_number_seq` in `server/prisma/migrations/*_init/migration.sql` for the
exact allocation pattern once a quote-creation endpoint is added.

## Structure

- `src/data/` — generated pricing JSON (do not hand-edit; regenerate from the xlsx instead)
- `src/types/pricing.ts` — shared types for the pricing data
- `src/lib/priceLookup.ts` — width/height price lookup; typed sizes are rounded up to the next available bracket in the matrix
- `src/lib/pricingContext.tsx` — active price list (bundled default, or an in-session imported one)
- `src/lib/xlsxImport.ts` — browser-side xlsx parser for the drag-and-drop import
- `src/lib/quoteContext.tsx` — quote/cart state (React Context + `localStorage`)
- `src/pages/` — Home (product list + import), ProductCalculator, AddOns, QuoteSummary

## Known gap

The "Grille" product's data sheet is marked "DO NOT USE FOR PRICING" in the source spreadsheet and has
no corresponding markup sheet, so it isn't included in the calculator yet. Add it once a proper pricing
sheet exists for that product line.
