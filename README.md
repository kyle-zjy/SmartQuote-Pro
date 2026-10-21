# SmartQuote Pro

React + TypeScript quoting tool for GOLDCO Security Group's supply & install price list
(`documents/Supply & Install (17-5-26).xlsx`).

## Getting started

```bash
npm ci
npm ci --prefix server
docker compose up -d
# In server/: copy .env.example to .env if absent, then run:
# npx prisma migrate deploy && npx prisma generate && npm run prisma:seed && npm run bootstrap
npm run dev --prefix server          # keep running in a separate terminal
npm run dev -- --host 127.0.0.1 --port 5174
```

Build for production with `npm run build`.

### GitHub Pages demo

For the later shared deployment, see the [English production deployment guide](docs/deployment-guide-en.md).

Run **Deploy GitHub Pages** in GitHub Actions with `data_mode=local` to publish
the browser-only demo without an API or database. Data stays in each browser;
server account administration and cross-browser sharing require the full backend.
Production demo login fields are empty: use `admin@goldco.com.au / admin` or
`staff@goldco.com.au / staff` for a fresh browser profile.

Once a backend is deployed, choose `data_mode=server` and provide its public HTTPS
`api_url` ending in `/api/v1` (or set the repository variable `VITE_API_URL`).
Server deployments reject a missing or invalid API address before publishing.

Local UI: `http://localhost:5174`. See [项目逻辑与当前实现](docs/project-logic-zh.md)
for the quote workflow, data ownership, local setup, and remaining backend work.

The default data source is now the Express API and PostgreSQL. Staff and admins in separate
browser profiles share quotes, reviews, working copies, photos, accounts, company settings and prices.
Local development accounts: `staff@goldco.com.au / staff`, `admin@goldco.com.au / admin`.
Quote backups and draft recovery are under **Quotes → Backup, restore & shared drafts**.
Existing browser data is preserved; sign in as admin and use **Import previous browser quotes**
on Quotes to copy missing records to the database. Existing server versions are never overwritten.
Same-quote editing is protected across tabs, with optimistic revision checks across browsers.
Newly issued quotes retain the company, bank and terms details used when they were issued.

## How pricing data flows

The price matrices live in the source Excel file, not in the app. `scripts/generate-pricing-data.py`
reads the workbook and writes `src/data/pricing.json` and `src/data/addons.json`, which the frontend
imports directly as the default/bundled price list. All prices are rounded to whole dollars.

When the price list is updated, regenerate the data:

```bash
uv venv .venv                 # only if .venv does not already exist
uv pip install --python .venv/bin/python openpyxl
uv run --no-project --python .venv/bin/python scripts/generate-pricing-data.py
uv run --no-project --python .venv/bin/python scripts/generate-colours.py
```

### Importing an updated price list from the browser

The Home page also has a drag-and-drop zone that lets a user load a newer version of the price list
xlsx directly in the browser, without rebuilding the app. `src/lib/xlsxImport.ts` is a TypeScript port
of the same extraction algorithm as `scripts/generate-pricing-data.py` (kept in sync manually), so the
uploaded file **must use the same template** — same sheet names, same title text, same matrix/extras
layout — only the numbers are expected to change. Admin imports are saved to the shared database
and refresh in other connected browsers. Saved line prices and issued documents remain fixed.
`documents/Supply & Install (TEST - updated prices).xlsx` is a same-template copy
with prices bumped ~10% and dates shifted, generated for exercising this import path.

Backend handoff: [Chinese teammate brief](docs/backend-handoff-zh.md); [English contract](docs/backend-api-and-schema-en.md).

## Backend (server/)

The backend provides database authentication, staff administration and a versioned workspace API.
See [current backend integration](docs/backend-integration-zh.md) for the implemented contract;
the older teammate handoff describes the original normalized-schema proposal.

```bash
docker compose up -d                 # starts Postgres on localhost:5432
cd server
cp -n .env.example .env              # preserve an existing local configuration
npm ci
npx prisma generate
npx prisma migrate deploy           # applies committed migrations
npx prisma db seed                  # initializes an empty database only
npm run bootstrap                   # initializes missing shared defaults and local accounts
npm run dev                          # http://localhost:3001
```

Check `/health` (process alive) and `/health/ready` (database reachable). All `/api/v1/`
business routes require the server-issued bearer token obtained from `/api/v1/auth/login`.
Database connection
failures return JSON HTTP 503; other unexpected errors return JSON HTTP 500.
`npm test` inside `server/` checks those failure and recovery paths.

Seeding is transactional and skips a database containing catalog or business records.
It never clears customers, quotes, staff or existing pricing. Updating an existing catalog
needs a separate migration/import process. The new application data lives in `workspace_records`
as complete versioned JSONB documents. This preserves all existing wizard, annotation and issued
snapshot fields; the original normalized `quotes`/`quote_lines` tables remain intact.
Quote numbers are allocated transactionally through `workspace_clock`, including manual-number
reservations. Passwords use salted scrypt hashes; sessions are revocable and expire after 7 days.
Production bootstrap requires explicit initial passwords. `VITE_API_URL` and `CORS_ORIGINS`
configure separately hosted frontends; no production deployment is performed by local setup.

Use **My account** to change a password; admins can reset another account's password from
**Admin → Staff**, confirming their own administrator password. New/reset/imported accounts
must change their temporary password before accessing shared data. New passwords require
12–256 characters including letters and numbers. Existing account passwords stay unchanged;
demo autofill is limited to development builds. Password recovery is handled by the office
administrator; email recovery is not configured.

In server mode, cache persistence errors have a separate warning and an in-memory fallback;
they do not turn a confirmed database save into a failed save. Until the cache recovers,
unsent edits may be lost on reload. Use **Retry browser cache** or download a quote backup.

## Structure

- `src/data/` — generated pricing JSON (do not hand-edit; regenerate from the xlsx instead)
- `src/types/pricing.ts` — shared types for the pricing data
- `src/lib/priceLookup.ts` — width/height price lookup; typed sizes are rounded up to the next available bracket in the matrix
- `src/lib/pricingContext.tsx` — shared active price list, with bundled defaults
- `src/lib/xlsxImport.ts` — browser-side xlsx parser for the drag-and-drop import
- `src/lib/quoteContext.tsx` — quote/cart state and recoverable local working copies
- `src/lib/serverWorkspace.ts` — server synchronization, import and revision conflict handling
- `server/src/workspace.ts` — atomic database writes, workflow permissions and validation
- `src/pages/` — Home, quote intake/list/workspace, opening/repair wizard, admin settings/reviews/staff

## Known gap

The "Grille" product's data sheet is marked "DO NOT USE FOR PRICING" in the source spreadsheet and has
no corresponding markup sheet, so it isn't included in the calculator yet. Add it once a proper pricing
sheet exists for that product line.
