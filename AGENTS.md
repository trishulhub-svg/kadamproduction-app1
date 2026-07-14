# AGENTS.md

## Cursor Cloud specific instructions

Single product: **Kadam Production** — a Next.js 15 (App Router) operations app backed by
Turso (libSQL/SQLite) via Drizzle ORM. There is one app at the repo root; no monorepo, no
Docker, no automated test suite. Standard commands live in `package.json` `scripts` and the
`README.md` "Quick start"; only the non-obvious caveats are captured here.

### Local database (no Turso credentials in this environment)
- The dev environment uses a **local libSQL file DB** instead of hosted Turso. `.env.local`
  (gitignored) sets `TURSO_DATABASE_URL=file:local.db`, an empty `TURSO_AUTH_TOKEN`, and a
  generated `AUTH_SECRET`. Both `.env.local` and `local.db` persist in the VM snapshot, so you
  normally don't need to recreate them.
- To recreate the DB from scratch: ensure `.env.local` exists, then
  `TURSO_DATABASE_URL=file:local.db TURSO_AUTH_TOKEN=dummy npm run db:push`.
  **`drizzle-kit push`/`generate` require a non-empty `TURSO_AUTH_TOKEN`** even for a file DB
  (the `turso` dialect rejects an empty token); any placeholder like `dummy` works for a file
  URL. The app runtime (`src/lib/db.ts`) does not need a token for a file URL.
- **`npm run db:seed` fails on a fresh `db:push` DB.** `drizzle/schema.ts` uses drizzle
  `$defaultFn` (app-side) for `created_at`/`updated_at`, so `db:push` creates those columns as
  `NOT NULL` with **no SQL default**, while `drizzle/seed.ts` does a raw `INSERT` that omits
  them → `SQLITE_CONSTRAINT_NOTNULL`. Seed the admin with a raw insert that supplies
  `created_at`/`updated_at` (e.g. `unixepoch()`). The app itself is unaffected because it
  inserts through Drizzle, which supplies those values.
- Seeded admin login: **`admin@kadamproduction.in` / `admin123`**. In this environment
  `must_change_pwd` was set to `0` so login goes straight to the dashboard (a fresh seed sets
  it to `1`, which forces `/change-password?force=1` on first login).

### IMPORTANT: `npm run dev` breaks client-side JS (CSP + eval)
- `next.config.ts` sets a strict CSP: `script-src 'self' 'unsafe-inline'` with **no
  `'unsafe-eval'`**. Next.js **dev mode** loads client modules via `eval()` (HMR), so in
  `npm run dev` the browser throws `Uncaught EvalError` and **client hydration fails** —
  forms, the post-login redirect, and modals (e.g. "Add Category") do not work, even though
  server rendering and API routes respond fine.
- For **interactive / end-to-end UI testing, use a production build**, where Next does not use
  `eval` and the CSP is satisfied: `npm run build` then `npm run start`
  (add `PORT=3001` to run alongside a dev server on 3000). This is how the app was verified
  end-to-end (login → create category).

### Lint / typecheck / build / run
- **No ESLint config is committed**, so `npm run lint` (`next lint`) prompts interactively to
  create one and cannot run non-interactively as-is. Use `npm run typecheck` (`tsc --noEmit`)
  for static checks; `npm run build` also runs type-checking.
- No test runner or test files exist ("testing" = running the app and exercising flows).
- Dev server: `npm run dev` (port 3000, SSR/API only — see CSP caveat above).
- Prod (fully interactive): `npm run build` && `npm run start` (default port 3000).
