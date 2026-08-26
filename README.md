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
