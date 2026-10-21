# SmartQuote Pro: Future Production Deployment Guide

Updated: 21 October 2026

## 1. Current state

The public GitHub Pages site runs the **browser-only demo** using
`VITE_DATA_MODE=local`. Its records belong to each browser. It does not connect to
the PostgreSQL database running on a developer's computer.

The shared backend works locally, but a production backend and hosted database
have not been provisioned. Publishing frontend files alone does not deploy them.

| Component | Current location | Planned production location |
| --- | --- | --- |
| React frontend | GitHub Pages demo and local Vite server | GitHub Pages |
| Express API | Local Node.js process in `server/` | Fly.io, or another Node.js host |
| PostgreSQL | Local Docker container | Neon, or another managed PostgreSQL service |
| Accounts, quotes, reviews, drafts, photos and settings | Local PostgreSQL in shared mode | The hosted database used by the production API |

Source repository: [SylviaWwww/SmartQuote-Pro](https://github.com/SylviaWwww/SmartQuote-Pro).
Pages repository: [kyle-zjy/SmartQuote-Pro](https://github.com/kyle-zjy/SmartQuote-Pro).
Public demo: [SmartQuote Pro](https://kyle-zjy.github.io/SmartQuote-Pro/).

The Pages workflow is **manually triggered**. Pushing a commit does not publish
the website automatically. Future production deployment should be explicitly
scheduled after the backend and database are ready.

## 2. Reproduce the project from GitHub

A teammate needs repository access, Git, Node.js 24 with npm, and a running Docker
Engine/Desktop installation with Compose. The commands below use the committed
npm lockfiles; Python and pnpm are not needed to run the application.

Clone the source repository and install both sets of dependencies:

```bash
git clone https://github.com/SylviaWwww/SmartQuote-Pro.git
cd SmartQuote-Pro
git switch main
git pull --ff-only origin main
npm ci
npm ci --prefix server
docker compose up -d
docker compose exec postgres pg_isready -U smartquote -d smartquote
```

Wait until PostgreSQL accepts connections. Copy `server/.env.example` to
`server/.env` on the first setup; keep an existing `.env` file rather than
overwriting it. The example points to the local Compose database and is for local
development only.

Initialize the local database and start the API in the first terminal:

```bash
cd server
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run bootstrap
npm run dev
```

In a second terminal, from the repository root, start the frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://localhost:5174`. Fresh local accounts are
`admin@goldco.com.au / admin` and `staff@goldco.com.au / staff`. If an account's
password has already changed in that database, use its current password;
bootstrap does not reset it. API readiness can be checked at
`http://localhost:3001/health/ready`.

Ports 5432, 3001 and 5174 must be available. On Windows, Docker Desktop must be
running; enable its WSL integration when running these commands inside WSL.

Git shares code, migrations and initialization data, not the developer's database
or browser records. Each teammate following these steps gets an independent local
database. To reproduce particular quotes, exchange a quote backup or arrange a
separate database transfer. To collaborate on the same live records, use one
reachable shared API/database after production or staging hosting is configured.

For later updates, pull the approved code, reinstall dependencies if lockfiles
changed, apply `npx prisma migrate deploy` from `server/`, rebuild/restart as
needed, and retain the existing Docker volume. `docker compose down -v` removes
the local database volume and is not a normal update step.

### Where the database is defined

| File or directory | Purpose |
| --- | --- |
| [`server/prisma/schema.prisma`](../server/prisma/schema.prisma) | Prisma models and database table mappings |
| [`server/prisma/migrations/`](../server/prisma/migrations/) | Committed SQL changes applied by `prisma migrate deploy` |
| [`server/src/db.ts`](../server/src/db.ts) | Shared Prisma Client instance |
| `server/.env` | Private local `DATABASE_URL`; not committed |
| [`server/src/workspace.ts`](../server/src/workspace.ts) | Database operations and validation for quotes, reviews, drafts, photos and settings |
| [`server/src/auth.ts`](../server/src/auth.ts) | Account, password and session operations |
| [`server/prisma/seed.ts`](../server/prisma/seed.ts) | Initial catalog data for a new database |
| [`server/scripts/bootstrap.ts`](../server/scripts/bootstrap.ts) | Missing initial accounts and shared workspace defaults |
| [`docker-compose.yml`](../docker-compose.yml) | Local PostgreSQL service and persistent data volume |

These files define and operate the database; the actual records live in
PostgreSQL, outside Git.

## 3. Production architecture

```text
Browser
  |-- HTTPS --> GitHub Pages: React application
  |-- HTTPS --> Hosted Express API: authentication and business operations
                      |-- TLS --> Hosted PostgreSQL database
```

The frontend uses a public API address such as
`https://<api-app>.fly.dev/api/v1`. Database credentials belong only to the API
environment. Never put a database URL or password in a `VITE_*` variable: these
variables are compiled into public browser assets.

The database stores application documents in `workspace_records`, with revision
checks and a shared quote-number clock. Accounts and revocable sessions use
`staff_users` and `auth_sessions`. The older normalized quote tables remain in
the schema; copying only those tables would omit the UI's current business data.

## 4. Prepare accounts and environments

Before deploying, arrange:

- Access to the Pages repository and its GitHub Actions environment.
- A backend hosting account and a managed PostgreSQL project.
- A production database, for example `smartquote_pro`, separate from development
  and integration-test databases.
- Real initial administrator and staff email addresses, with distinct passwords.
- A hosting region and database region selected together to limit network latency.
- A database backup and recovery procedure with a named team owner.

Fly.io and Neon are the previously discussed hosting options. No paid resources
are created by this guide. Review the providers' current usage limits and billing
before provisioning them; this document does not assume a fixed monthly price.

## 5. Configure the database

Create a PostgreSQL database and obtain its TLS connection URL. The committed
initial migration creates the `citext` extension, so the migration role must be
allowed to create it.

For the first deployment, a direct PostgreSQL connection can be used for both
the long-running API and migrations. If connection pooling is introduced, use
the provider's pooled URL for application traffic and its direct URL for
migration/admin operations. Neon documents the two URL types in its
[Prisma connection guide](https://neon.com/docs/guides/prisma).

This repository currently uses **Prisma 5** and reads `DATABASE_URL` from
`server/prisma/schema.prisma`. It does not automatically read `DIRECT_URL` or
`DATABASE_URL_UNPOOLED`. To run a migration against a different endpoint, supply
the direct URL as `DATABASE_URL` for that command. Keep the committed lockfile;
upgrading to the Prisma version shown in a newer provider tutorial is a separate
code change.

## 6. Configure the backend environment

| Variable | Required value or purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Backend listening port; currently defaults to `3001` |
| `DATABASE_URL` | Production PostgreSQL connection URL, with the provider's TLS settings |
| `CORS_ORIGINS` | Exact frontend origins, comma-separated without extra spaces |
| `INITIAL_ADMIN_EMAIL` | Email for a missing initial administrator account |
| `INITIAL_ADMIN_PASSWORD` | Required by production bootstrap |
| `INITIAL_STAFF_EMAIL` | Email for a missing initial staff account |
| `INITIAL_STAFF_PASSWORD` | Required by production bootstrap |

For the existing Pages site, use:

```text
CORS_ORIGINS=https://kyle-zjy.github.io
```

The origin has no `/SmartQuote-Pro/` path and no trailing slash. Add a custom
domain's origin separately if one is introduced. CORS configuration does not
replace authentication; the API still checks bearer tokens and account roles.

New passwords must contain 12–256 characters, including a letter and a number.
Production bootstrap requires both initial passwords and validates them when
creating missing accounts. It preserves existing accounts and does **not**
rotate passwords in an imported database. Existing demo passwords must be changed
before that database is used for real production work.

Keep credentials in the hosting platform's secret store, outside Git. On Fly.io,
secrets are injected into the application environment; see its
[secret management documentation](https://fly.io/docs/apps/secrets/). A private
environment file can be imported over stdin after an app has been created:

```bash
fly secrets import --app your-api-app --stage < /absolute/path/to/private-production.env
```

Replace `your-api-app` and the file path with your actual values. The file must
contain `NAME=VALUE` pairs, and must remain outside the repository.
See the [Fly secrets import command](https://fly.io/docs/flyctl/secrets-import/).

## 7. Prepare backend packaging

The repository does not yet contain a production backend Dockerfile or a
`fly.toml`. Create and test those before attempting a Fly.io release.

The backend image/build configuration needs to:

1. Use Node.js 24 and install dependencies from `server/package-lock.json`.
2. Generate Prisma Client and compile the server with `npm run build` in `server/`.
3. Start the server with `npm start` from `server/`; the entry point is
   `dist/src/index.js`, not `dist/index.js`.
4. Preserve `server/prisma`, its migrations, and any initialization scripts used
   during the release.
5. Include the required `src/data/` assets at their original repository-relative
   location. Both seeding and bootstrap read frontend data files; deploying only
   the `server/` directory is insufficient for those initialization commands.
6. Retain `tsx` and the Prisma CLI wherever bootstrap, seeding and migrations run.
   These currently live in server development dependencies, so an install using
   only `--omit=dev` cannot perform initialization by itself.
7. Exclude `.env` files, credentials, local dependency directories, dependency
   backups and test artifacts from the Docker build context.

Use the repository root as the Docker build context. Fly.io supports a supplied
Dockerfile; see its [Node.js Dockerfile guide](https://fly.io/docs/js/the-basics/dockerfiles/).

In the future `fly.toml`, match the HTTP service's `internal_port` to `PORT`, enable
HTTPS, and configure `/health/ready` as a readiness check. Allow enough shutdown
time for the server's existing ten-second graceful shutdown. Select machine size,
region and idle-stop behavior after testing the application. The available fields
are documented in the [Fly app configuration reference](https://fly.io/docs/reference/configuration/).

## 8. Initialize and deploy the backend

Run the following from a controlled environment with production secrets loaded
privately. For migration commands, `DATABASE_URL` must identify the intended
production database. Do not copy the development `.env` into the deployment.

```bash
cd server
npm ci --include=dev
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
NODE_ENV=production npm run bootstrap
npm run build
```

Run seeding before bootstrap on a new database. Seeding is initialization-only
and skips an existing catalog or database containing the records it checks.
Bootstrap adds missing accounts and shared defaults; it does not overwrite
existing settings or passwords. Neither command transfers local business data.

Apply committed migrations in a single controlled release step. Do not use
`prisma migrate dev`, `migrate reset` or `db push` as the production upgrade path.
Once packaging, secrets, initialization and release configuration are ready,
deploy the backend using the hosting provider's release process.

Check the deployed API before changing the frontend:

```bash
DEPLOY_API_ORIGIN='https://your-api-app.fly.dev'
curl --fail "$DEPLOY_API_ORIGIN/health"
curl --fail "$DEPLOY_API_ORIGIN/health/ready"
```

Replace the example hostname with the deployed API hostname. Expected readiness response:

```json
{"ok":true,"database":"ready"}
```

Also verify a real login through the intended frontend origin. A healthy process
alone does not prove that CORS, accounts, migrations and shared records are ready.

## 9. Switch GitHub Pages to shared mode

Only proceed once the public API and hosted database are working.

1. Push the approved frontend commit to the Pages repository's `main` branch.
2. Open **Actions → Deploy GitHub Pages → Run workflow** in that repository.
3. Select `data_mode=server`.
4. Enter `api_url=https://<api-app>.fly.dev/api/v1`, or configure the repository
   variable `VITE_API_URL` with that value.
5. Run the workflow and wait for both the build and Pages deployment to succeed.
6. Open the public site and complete the checks below.

The workflow rejects missing, non-HTTPS or localhost API addresses in server
mode. `VITE_API_URL` is a **build-time** setting: changing it requires another
frontend build and deployment. The API cannot use `localhost` to reach a service
on somebody else's computer.

To intentionally publish a browser-only demo, select `data_mode=local` instead.
That mode does not provide shared data or administrator password-reset APIs.
Production builds do not fill in demo login credentials automatically.

## 10. Transfer data deliberately

Choose the scope of migration before users begin working in production:

| Existing source | Transfer approach |
| --- | --- |
| Quotes stored in a browser | Export a quote backup, then restore it as an administrator in shared mode. From the same original browser/origin, the legacy import action can also import preserved browser records. |
| Complete local shared database | Back it up and restore it into a controlled hosted database, then apply any pending migrations and validate account credentials. |
| Shared settings or pricing | Confirm or import the intended production configuration separately. |

Localhost and GitHub Pages have different browser storage origins. The public
site cannot read localhost's localStorage or IndexedDB automatically. Use an
exported backup when moving between them.

A quote JSON backup is not a full database backup: it does not include account
credentials, sessions and the complete configuration/audit history. Use database
backup tooling for complete recovery. Repeating bootstrap is not a data transfer
or password-reset mechanism.

## 11. Acceptance checks and ongoing releases

Before inviting the team, verify:

- Staff and administrators can log in from separate browsers.
- A saved quote, its photos and submitted review appear in the other browser.
- Return, resubmission, approval and issue follow the intended permissions.
- Concurrent edits produce a conflict instead of silently overwriting work.
- New/reset accounts must change their temporary passwords before accessing data.
- Changing or resetting a password invalidates the appropriate old sessions.
- Refreshing and opening a direct quote URL work under `/SmartQuote-Pro/`.
- Issued document totals, company details and terms remain consistent.
- Backups can be restored into a separate recovery database.

For later code releases, run:

```bash
npm test
npm run build
npm run test:server
```

The integration runner needs Docker/PostgreSQL and Playwright's browser/system
dependencies. It creates its own `smartquote_integration_*` database by default.
Never point integration tests at production.

For each release, record the source commit, migration state, backup location,
backend deployment and frontend deployment. Deploy backward-compatible database
changes and backend code before a frontend that depends on them. Monitor API
readiness, errors, database storage, connection usage and hosting usage.

Photos currently live as image data in JSONB. Larger production workloads should
evaluate image/object storage and incremental synchronization; the current
workspace polling approach transfers all records when the workspace changes.

## 12. Recovery and remaining work

If a release fails, keep the last working frontend/backend release available and
redeploy the appropriate known-good commit through the normal workflow. A backend
rollback must be compatible with the database schema already applied. Restoring a
database backup can discard newer records and needs a separate recovery decision.

Switching Pages back to `local` creates a browser-only demo; it does not restore
or expose production server records.

Before treating this as a production service, complete backend packaging,
repeatable release automation, scheduled database backups, monitoring and a
restore drill. Password recovery currently uses an administrator reset; email
recovery and mail delivery are not configured. No production backend or database
is created by committing this guide.
