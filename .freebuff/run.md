# FlowDesk — Dev Server Run Doc

## How to reproduce the artifacts a fresh checkout needs

1. Install dependencies with pnpm (the project's package manager):

   ```bash
   pnpm install
   ```

   `pnpm-workspace.yaml` already approves the `@prisma/engines` and `prisma`
   build scripts. The `postinstall` hook runs `prisma generate` (needs the
   env file from step 2, but failures are swallowed by `|| exit 0`).

2. Copy the environment file from the main checkout — it is gitignored and
   never committed:

   ```bash
   cp ../flowdesk/.env/.env.dev .env/.env.dev
   ```

   It must contain (quoted values):
   - `DATABASE_URL` — PostgreSQL connection string for the `flowdesk` dev DB
     on `localhost:5432`
   - `AUTH_SECRET` — random base64 secret used by Auth.js
   - `TEST_DATABASE_URL` — connection string for the `flowdesk_test` DB used
     by Vitest (provisioned automatically by `tests/global-setup.ts`)

3. Ensure local PostgreSQL is running on `localhost:5432` and the schema is
   applied. The CLI reads `.env/.env.dev` through `prisma.config.ts`:

   ```bash
   pnpm exec prisma migrate deploy
   ```

4. (Optional, for tests) `pnpm test` provisions and truncates the dedicated
   test database automatically.

## How to run the server

```bash
pnpm dev
```

Next.js dev server on http://localhost:3000 (port 3000 is the default and is
used by this preview). `next.config.ts` loads `.env/.env.dev` explicitly, so
no shell env exports are required.

Behavior to expect:
- `/` (root) redirects unauthenticated users to `/login` and authenticated
  users to `/dashboard`.
- `/login` and `/register` are the public auth pages.
- `/dashboard`, `/customers`, `/settings`, … are protected: unauthenticated
  requests are redirected to `/login?callbackUrl=…`.

Detached/background start used for the preview (Windows, logs must go to two
different files):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p','3000' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```
