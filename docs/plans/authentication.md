# Implementation Plan: Authentication

## 1. Objective

Implement the Authentication feature defined in `docs/features/authentication.md`:

- Secure user registration, including creation of the user's initial workspace and an OWNER membership.
- Login with email and password credentials.
- Logout that terminates the session.
- Session handling via Auth.js.
- Server-side protection of protected application routes.
- Server-side authentication checks and the initial authorization boundary (workspace membership).
- Input validation, consistent error handling, and workspace isolation at the authentication boundary.

The implementation must follow the baseline architecture in `docs/decisions/ADR-001-architecture-baseline.md` (Next.js App Router, React, TypeScript strict, Tailwind CSS, PostgreSQL, Prisma, Auth.js, Zod, pnpm) and the constraints in `docs/architecture/architecture.md` and `docs/architecture/database.md`.

## 2. Scope

### In Scope

- Registration form and server-side registration flow:
  - Input validation (email format, password requirements, required fields).
  - Duplicate-account detection with a safe error.
  - Create `User`, create the initial `Workspace`, create the `Membership` with role `OWNER` (transactional).
  - Authenticate the new user through Auth.js `signIn("credentials", ...)` (the same single path used by login) and redirect to the protected application.
- Login form and server-side login flow:
  - Input validation.
  - Credential verification through the Auth.js Credentials provider — the single source of truth for credential checks.
  - Session establishment.
  - Generic error for invalid credentials (no account-existence disclosure).
  - Redirect to the protected application.
- Logout:
  - Terminate the session.
  - Redirect to the login flow.
- Protected routes:
  - Unauthenticated access to protected areas rejected or redirected to `/login`.
  - Enforcement server-side (middleware) plus defense-in-depth check in the dashboard layout.
- Session handling:
  - Auth.js session with minimal session data (user id, email).
  - Workspace-specific authorization data resolved server-side, never stored in the session.
- Server-side authorization boundary:
  - Authenticated user identity resolved server-side.
  - Workspace membership resolved server-side; role is workspace-scoped.
- Database changes:
  - New `User`, `Workspace`, `Membership` models and `Role` enum.
  - Initial Prisma migration (non-destructive; creates new tables only).
- Auth UI:
  - `/register` and `/login` pages using the project's design tokens.
  - Client-side form interactivity, loading states, inline error display.
  - Logout control in the application shell.
- Root route (`/`) redirect behavior for unauthenticated and authenticated users (proposed default; see Open Questions).
- Testing, type checking, and linting for the feature.

### Out of Scope

- OAuth providers, two-factor authentication, password reset, email verification, single sign-on, session management UI (`docs/architecture/authentication.md` §12).
- Customer, Deal, Activity, and Team feature implementations (their own feature specifications will define them).
- Role/permission management UI and full RBAC enforcement for CRM operations (authorization rules are defined, but enforcement points for those features belong to their feature implementations).
- Multi-workspace UX (workspace switching, workspace selection screens) — not specified.
- Workspace renaming UI — not specified.
- Email sending or invitation flows — not specified.
- Modifying the existing placeholder pages (`/dashboard`, `/customers`, `/settings`) beyond the auth protection and shell integration required by this feature.

## 3. Existing Repository Analysis

### Project baseline

- Next.js `16.3.3` (App Router), React `19.2.8`, TypeScript `strict` (`noEmit`), Tailwind CSS v4, `eslint-config-next` (flat config), pnpm workspace.
- Scripts in `package.json`: `dev`, `build`, `start`, `lint` (`eslint`), `postinstall` (`prisma skills sync || exit 0`).
- There is **no `typecheck` script** and **no test script**. These are added as part of this plan (Task 1 / Task 11).

### Existing application files

- `src/app/layout.tsx` — root layout (no font wiring; Poppins is declared in tokens but not loaded).
- `src/app/page.tsx` — placeholder home page at `/`.
- `src/app/(dashboard)/layout.tsx` — renders `<Sidebar />` + children; **not protected**.
- `src/app/(dashboard)/dashboard/page.tsx`, `customers/page.tsx`, `settings/page.tsx` — placeholder pages.
- `src/app/components/layout/Sidebar.tsx` — real component using design tokens (`text-h5`, `text-primary-accent`, `text-body-medium-14`, `text-heading`, `bg-bg`, `border-border`); contains hardcoded user info ("John Doe" / "Administrator") that should come from the session.
- `src/app/components/layout/AppShell.tsx`, `Topbar.tsx` — unused placeholder stubs.
- `src/app/globals.css` — design tokens (colors, typography) and Poppins font variable; no token for form controls exists yet.

### Database / Prisma state

- **No `prisma/schema.prisma` and no `prisma/migrations/` exist.** The database layer is entirely absent.
- `prisma.config.ts` exists but only defines `skills` config (no datasource/env wiring).
- Installed: `prisma` `8.0.0-rc.12`, `@prisma/client` `7.10.0` (version pairing to be verified during implementation, see Open Questions).
- Env file exists at `.env/.env.dev` (72 bytes). Its contents are not readable by the planning agent. Note: neither Next.js nor the Prisma CLI auto-loads `.env/.env.dev` from the project root, so environment loading must be verified and wired (Task 1).

### Authentication / dependencies state

- **Auth.js (`next-auth`) is not installed.**
- **`zod` is present in `node_modules` only as a transitive dependency** (v4.5.2, via `eslint-config-next` → `eslint-plugin-react-hooks` → `zod-validation-error`); it is not a direct dependency and must be added.
- No password hashing library is installed.
- No `src/auth.ts`, no `middleware.ts`, no auth-related source code exists.

### Conventions and notes

- Design tokens are defined in `src/app/globals.css`; AGENTS.md requires using tokens instead of hardcoded values. Existing placeholder pages use raw classes (`text-3xl font-bold`) — a minor style inconsistency with AGENTS.md; the auth UI in this plan will use tokens.
- The `.agents`, `.claude`, `.cursor`, `.devin` skill folders contain `prisma-composer/SKILL.md`, which describes a Prisma Composer workflow (`module.ts`, `compute()`, `contract.prisma`, `prisma-composer deploy`). **This workflow is not used in this repository** — there are no composer artifacts (`module.ts`, `prisma-composer.config.ts`, `contract.prisma`) and `@prisma/composer` is not a dependency. The applicable database workflow is the classic Prisma schema + migrations flow required by `docs/architecture/database.md`. Implementers must not adopt the composer workflow.
- `README.md` documents npm/yarn/bun commands; the project uses pnpm. `package.json` lists `pnpm` as a dependency. Minor documentation inconsistencies; not blocking.

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| REQ-AUTH-001 / REQ-AUTH-005 / AC-AUTH-001 / AC-AUTH-002 (registration, duplicate rejection, safe errors) | Task 4 (register action/service), Task 2 (schema), Task 9 (UI errors) | Unit/integration tests for register; duplicate-account negative test |
| REQ-AUTH-002 / AC-AUTH-003 / AC-AUTH-004 (login, invalid credentials) | Task 5 (login action via Auth.js signIn), Task 9 (UI) | Integration tests for login through the Credentials provider; invalid-credential negative test |
| REQ-AUTH-003 / AC-AUTH-006 (logout, session terminated) | Task 6 (logout action), Task 7 (route protection) | Integration/E2E test: after logout, protected route requires auth |
| REQ-AUTH-004 / BR-AUTH-003 / AC-AUTH-005 (protected routes) | Task 7 (middleware + layout guard), Task 8 (server checks) | E2E/unit tests: unauthenticated access redirected to `/login` |
| REQ-WS-001 / BR-AUTH-002 (initial workspace + OWNER membership) | Task 2 (schema), Task 4 (registration transaction) | Integration test: registration creates workspace + OWNER membership |
| REQ-WS-002 / REQ-RBAC-001 (membership, role) | Task 2 (Membership model, Role enum) | Schema/migration review; integration test asserts role assignment |
| REQ-WS-003 / REQ-GEN-001 / BR-AUTH-004 (workspace isolation) | Task 8 (server-side membership boundary) | Isolation test: membership resolution is scoped to the authenticated user |
| REQ-RBAC-002 / REQ-RBAC-003 / REQ-RBAC-004 / BR-AUTH-005 (server-side authorization, no client trust) | Task 8 (authorization boundary), Task 7 (server-side enforcement) | Negative tests: no client-provided role/user identity is accepted |
| Feature spec §7 validation rules (email, password, required fields) | Task 4, Task 5 (Zod schemas) | Validation unit tests (invalid email, weak password, missing fields) |
| Feature spec §8 error cases (invalid input, duplicate, invalid credentials, missing credentials, expired/invalid session, unauthorized access, unexpected failure) | Tasks 4–7 (error mapping) | Negative tests for each error case; no sensitive detail assertions |
| Feature spec §10 edge cases (double submit, session expiry, direct protected-route access, access after logout) | Task 7, Task 9 (submission guards), Task 11 (tests) | Edge-case tests |
| REQ-GEN-002 (validation before processing) | Tasks 4–5 (Zod at server boundary) | Validation tests |
| REQ-GEN-003 (consistent error handling, useful feedback) | Tasks 4–6, Task 9 (error mapping/display) | Error-path tests |
| REQ-GEN-004 (loading states) | Task 9 (form pending states) | UI verification (manual + E2E) |
| Feature spec §11 Definition of Done (tests, typecheck, lint) | Tasks 11–12 | Verification checklist (section 9) |

## 5. Implementation Tasks

Tasks are ordered by dependency. Task 1 must complete before Tasks 2–3; Tasks 3 must complete before Tasks 4–8; Tasks 4–6 before Task 9; Tasks 7–8 before Task 10; Tasks 4–10 before Task 11; Task 12 is final.

### Task 1: Dependencies and environment configuration

**Purpose**

Install the dependencies mandated by the architecture (Auth.js, Zod as a direct dependency) and the credential-hashing library required to store passwords securely, and make environment configuration (database URL, Auth.js secret) load correctly.

**Files**

- `package.json`
- `pnpm-lock.yaml` (via install)
- `.env/.env.dev` or equivalent env file (verify existing values; add `AUTH_SECRET` and confirm `DATABASE_URL`)
- `prisma.config.ts` (env loading, if required by Prisma 8)

**Changes**

- Add direct dependencies:
  - `next-auth` (Auth.js) — mandated by ADR-001 and `docs/architecture/authentication.md`.
  - `zod` — mandated by ADR-001 and `docs/architecture/architecture.md` §8 (currently only transitive; must be declared directly).
  - `bcryptjs` (pure-JS password hashing) — required to satisfy "protect credentials" (`docs/architecture/authentication.md` §10); no hashing capability exists in the current dependency set. (Alternative: Node's built-in `crypto.scrypt`; see Open Questions — decision required before implementation.)
- Add a `typecheck` script: `"typecheck": "tsc --noEmit"`.
- Verify env loading:
  - Confirm `DATABASE_URL` exists for the Prisma CLI and Next.js runtime.
  - Add `AUTH_SECRET` (generate a strong random value) for Auth.js.
  - If the project's env file location (`.env/.env.dev`) is not auto-loaded by Next.js and the Prisma CLI, wire loading explicitly (e.g., dotenv import in `prisma.config.ts` for the CLI, and Next.js env-file support for the app) without changing the secret-storage model (`.env*` remains gitignored).
- Do not commit secrets. No `.env` content enters the repository.

**Dependencies**

- None.

**Verification**

- `pnpm install` succeeds with no peer-dependency errors.
- `pnpm typecheck` runs and passes on the unchanged codebase.
- `pnpm lint` passes.
- Prisma CLI resolves `DATABASE_URL` (e.g., `prisma validate` against the new schema in Task 2, or a dry-run command available in the installed Prisma 8 RC).
- Next.js dev server boots (`pnpm dev`) and reports no env-related errors.

### Task 2: Prisma schema and initial migration

**Purpose**

Create the database layer required by the Authentication feature: `User`, `Workspace`, `Membership`, and the `Role` enum, per `docs/architecture/database.md`.

**Files**

- `prisma/schema.prisma` (new)
- `prisma/migrations/` (new, generated)
- `src/lib/prisma.ts` (new) — PrismaClient singleton for server-side use (standard Next.js + Prisma pattern; the only Prisma access point; client components must never import it).

**Changes**

- Define `Role` enum: `OWNER`, `MANAGER`, `MEMBER` (REQ-RBAC-001).
- `User`:
  - `id String @id @default(cuid())`
  - `email String @unique` (BR-AUTH-001; unique account identity)
  - `passwordHash String`
  - `memberships Membership[]`
  - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- `Workspace`:
  - `id String @id @default(cuid())`
  - `name String @default("My Workspace")` (proposed default; see Open Questions — workspace naming is not specified anywhere)
  - `memberships Membership[]`
  - `createdAt`, `updatedAt`
- `Membership`:
  - `id String @id @default(cuid())`
  - `userId String` → `User` (`@relation`, `onDelete: Cascade`)
  - `workspaceId String` → `Workspace` (`@relation`, `onDelete: Cascade`)
  - `role Role` (REQ-RBAC-001; workspace-scoped role — `docs/architecture/database.md` §5)
  - `@@unique([userId, workspaceId])` (unique membership; database constraint per §13)
  - `@@index([workspaceId])`, `@@index([userId])`
  - `createdAt`, `updatedAt`
- ID strategy: Prisma `cuid()` — `docs/architecture/database.md` §11 delegates the exact strategy to implementation.
- Generate the initial migration (e.g., `prisma migrate dev --name init_authentication`) and review the generated SQL. This migration is non-destructive: it creates three new tables and one enum; no existing data is affected. Per database.md §14/§15, the migration must be reviewed before being applied to any shared environment.
- Confirm the Prisma 8 RC CLI migration workflow (`prisma migrate dev`) against the installed `8.0.0-rc.12` CLI before committing to commands (see Open Questions).

**Dependencies**

- Task 1 (env loading / `DATABASE_URL`).

**Verification**

- `prisma validate` and `prisma migrate dev` succeed.
- Migration SQL contains only additive changes (new tables, enum, indexes, FK constraints).
- `pnpm typecheck` passes (Prisma client regenerated).

### Task 3: Auth.js core configuration

**Purpose**

Establish the Auth.js (next-auth) session layer: credentials provider, JWT session strategy, minimal session payload, and sign-in page wiring.

**Files**

- `src/auth.ts` (new) — Auth.js v5 configuration and exported `auth`, `signIn`, `signOut`, `handlers`.
- `src/app/api/auth/[...nextauth]/route.ts` (new) — route handler re-exporting `handlers` (required by next-auth v5 for the framework endpoints).

**Changes**

- Configure `NextAuth` with:
  - `providers: [Credentials(...)]` — `authorize()` looks up the user by email (Prisma, via `src/lib/prisma.ts`), verifies the password hash (bcryptjs), and returns only `{ id, email }` (never the hash, never role data). **`authorize()` is the single source of truth for credential verification**: it is the only code path that verifies a presented password. Registration (Task 4) hashes a *new* password but never verifies one, and no other module performs a hash comparison.
  - `session: { strategy: "jwt" }` — Auth.js default; no database adapter is required because OAuth and database sessions are out of scope.
  - `callbacks.jwt` / `callbacks.session` — expose `session.user.id` and `session.user.email` only (minimal session data per `docs/architecture/authentication.md` §8).
  - `pages: { signIn: "/login" }`.
  - `secret` from `AUTH_SECRET` env.
- Do not store role or workspace data in the session/token; membership and role are resolved server-side (BR-AUTH-004/005, `docs/architecture/authentication.md` §8–9).

**Dependencies**

- Task 1 (install `next-auth`, `AUTH_SECRET`).

**Verification**

- `pnpm typecheck` passes.
- Dev server boots; `GET /api/auth/providers` responds without errors.
- Session object shape is verified in tests: contains only `id` and `email` (plus standard Auth.js fields), no password/role data.

### Task 4: Registration (server action and service)

**Purpose**

Implement the registration flow per the feature spec §6 and §7: validate input, create the user, create the initial workspace, create the OWNER membership, authenticate, redirect.

**Files**

- `src/features/auth/schemas.ts` (new) — Zod schemas shared by server and client:
  - `registerSchema`: `email` (valid email, normalized/trimmed), `password` (minimum 8 characters — proposed policy, see Open Questions), required fields.
  - `loginSchema`: `email` (valid format), `password` (required).
- `src/features/auth/services.ts` (new) — registration business logic only, separated from UI per `docs/architecture/architecture.md` §5. A dedicated service is justified for registration because it creates `User` + `Workspace` + `Membership(OWNER)` transactionally; it contains **no credential-verification logic**:
  - `registerUser({ email, password })`:
    1. Validate with `registerSchema` (server boundary — REQ-GEN-002).
    2. Check for an existing account by email; if present, return a safe duplicate-account error (AC-AUTH-002).
    3. Hash the password (bcryptjs).
    4. In a single Prisma transaction: create `User`, create `Workspace`, create `Membership` with role `OWNER` (BR-AUTH-002, AC-AUTH-001, REQ-WS-001/002).
    5. Handle the race of concurrent duplicate registration by mapping the unique-constraint error (`P2002`) to the same safe duplicate-account error.
  - There is deliberately **no `loginUser` and no password-verification helper** in `services.ts`. Registration hashes a *new* password; it never verifies a presented credential. Verifying a presented password happens in exactly one place: the Auth.js Credentials provider `authorize()` (Task 3). This prevents verification logic from drifting between a service and the provider.
- `src/features/auth/actions.ts` (new) — server actions (`"use server"`) that orchestrate each flow (business logic stays out of presentation components):
  - `registerAction(formData)` — validates, calls `registerUser` (transactional creation), then authenticates the new user through the same Auth.js `signIn("credentials", ...)` path used by login, then redirects to `/dashboard`.
  - `loginAction(formData)` — implemented in Task 5; delegates authentication entirely to Auth.js `signIn("credentials", ...)` and performs no credential verification itself.
  - `logoutAction()` — calls `signOut()` and redirects to `/login` (Task 6).
- Errors are mapped to safe, user-facing messages; unexpected failures surface a generic error without implementation details (feature spec §8, REQ-GEN-003).

**Dependencies**

- Task 2 (schema), Task 3 (Auth.js sign-in).

**Verification**

- Integration test: valid registration creates one `User`, one `Workspace`, one `Membership` with role `OWNER`, and results in an authenticated session.
- Negative tests: invalid email, short password, missing fields, duplicate email (both sequential and concurrent).
- `pnpm typecheck` and `pnpm lint` pass.

### Task 5: Login (server action orchestrated through Auth.js)

**Purpose**

Implement the login flow per the feature spec §6. The login server action orchestrates authentication through Auth.js `signIn()`; the Credentials provider `authorize()` (Task 3) is the single source of truth for credential verification. The action must not independently verify credentials and then authenticate again — there is exactly one verification path in the application.

**Files**

- `src/features/auth/schemas.ts` (reused — `loginSchema`)
- `src/features/auth/actions.ts` (reused — `loginAction`)
- `src/auth.ts` (Task 3 — the Credentials provider performs the verification)
- `src/app/(auth)/login/page.tsx` (new; Task 9 renders the UI)
- Note: `src/features/auth/services.ts` is intentionally **not** part of the login path (no `loginUser` exists — Task 4).

**Changes**

- `loginAction`:
  1. Validate input with `loginSchema` (server-side format validation at the boundary — REQ-GEN-002).
  2. Call Auth.js `signIn("credentials", { redirect: false })` with the validated email and password. No pre-verification: the action does not look up the user or compare password hashes before calling `signIn`.
  3. Auth.js runs the Credentials provider `authorize()` (Task 3), which performs the user lookup and bcrypt comparison in that one place. On success, Auth.js establishes the session.
  4. On success, redirect to `/dashboard` (or the preserved `callbackUrl` when present).
  5. On failure (`signIn` throws Auth.js's `CredentialsSignin` error because `authorize()` returned `null`), catch it and return the single generic invalid-credentials error (AC-AUTH-004). `authorize()` returns `null` for both unknown email and wrong password, so the generic message never reveals whether the account exists (REQ-AUTH-005).
- `loginAction` never imports bcrypt and never reads `passwordHash` for comparison; it only validates format, delegates to `signIn`, and maps the outcome.
- Handle repeated submissions and missing credentials as specified error cases (feature spec §8, §10).

**Dependencies**

- Task 3 (Auth.js provider + `signIn`), Task 4 (shared schemas, `actions.ts`).

**Verification**

- Integration test: valid credentials → `loginAction` → `signIn` succeeds via the provider → session established → redirect.
- Negative tests: wrong password and unknown email each make `authorize()` return `null` → `loginAction` returns the same generic error; no session established in either case (no account-existence disclosure).
- Structural check/test: no password-verification (hash comparison) call exists outside `src/auth.ts`; `services.ts` only hashes (no second verification path to drift).
- `pnpm typecheck` and `pnpm lint` pass.

### Task 6: Logout

**Purpose**

Terminate the authenticated session per REQ-AUTH-003 / AC-AUTH-006.

**Files**

- `src/features/auth/actions.ts` (reused — `logoutAction`)

**Changes**

- `logoutAction` calls Auth.js `signOut()` (invalidates the session cookie), then redirects to `/login`.
- After logout, protected routes must require authentication again (AC-AUTH-006) — enforced by Task 7.
- Note: with the JWT session strategy, "session terminated" means the session cookie is destroyed client-side and the JWT can no longer be presented; server-side revocation of an already-issued JWT is not provided by this strategy (see Open Questions — DB-backed sessions were considered and are out of scope).

**Dependencies**

- Task 3 (Auth.js sign-out).

**Verification**

- Test: after `logoutAction`, session is absent; a request to a protected route is redirected to `/login`.
- `pnpm typecheck` and `pnpm lint` pass.

### Task 7: Protected routes

**Purpose**

Enforce REQ-AUTH-004 / AC-AUTH-005 server-side: unauthenticated users must not access protected application areas.

**Files**

- `src/middleware.ts` (new) — Auth.js middleware exporting `auth` (or `withAuth`) with a matcher covering the protected areas.
- `src/app/(dashboard)/layout.tsx` (modified) — add a server-side authentication check (defense in depth; the layout-level check is the security boundary for the dashboard group regardless of middleware behavior).
- `src/app/page.tsx` (modified) — server redirect: authenticated → `/dashboard`, unauthenticated → `/login` (proposed root behavior; see Open Questions).
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx` (new in Task 9) — optionally redirect authenticated users away (see Open Questions).

**Changes**

- Middleware matcher includes: `/dashboard`, `/customers`, `/deals`, `/activities`, `/team`, `/settings` and their sub-paths (the protected areas listed in `docs/architecture/authentication.md` §7; `/deals`, `/activities`, `/team` do not exist yet but are protected now so future features inherit the boundary).
- Unauthenticated requests to protected routes are redirected to `/login` (with the original destination preserved via `callbackUrl` so the post-login redirect is meaningful).
- `(dashboard)/layout.tsx` calls the server-side session check (`auth()`) and redirects to `/login` when there is no session. This is the authoritative server-side check per REQ-RBAC-003 and `docs/architecture/authentication.md` §10 ("enforce protected routes server-side").
- Root `/` behaves as described above (proposed default, flagged).

**Dependencies**

- Task 3 (Auth.js), Tasks 4–6 (login/logout flows complete so redirect targets exist).

**Verification**

- Unit/E2E test: unauthenticated requests to `/dashboard` (and other protected paths) are redirected to `/login` (AC-AUTH-005).
- Test: authenticated requests to protected paths are not redirected.
- Manual check that the middleware matcher does not shadow public assets/API routes.
- `pnpm typecheck` and `pnpm lint` pass.

### Task 8: Server-side authentication checks and authorization boundary

**Purpose**

Provide the server-side helpers that establish identity and resolve workspace membership, implementing BR-AUTH-004/005, REQ-WS-003, and the authorization boundary in `docs/architecture/authentication.md` §9.

**Files**

- `src/features/auth/session.ts` (new) — server-only session/membership helpers:
  - `getCurrentUser()` — returns the authenticated user (`{ id, email }`) from `auth()`, or `null`.
  - `requireUser()` — like `getCurrentUser`, but redirects to `/login` when unauthenticated.
  - `getWorkspaceContext(userId)` — resolves the user's memberships and workspaces via Prisma (workspace id, role), server-side only.
  - `requireWorkspaceMembership(userId)` — resolves membership; used as the workspace-isolation boundary for workspace-scoped operations.
- `src/app/(dashboard)/layout.tsx` (modified) — use `requireUser()`/`getWorkspaceContext` to derive the authenticated user's context (workspace id, role) and pass it to the shell (Sidebar/Topbar user display, Task 10).

**Changes**

- All identity and membership resolution happens server-side; the client never supplies user id, workspace id, or role (BR-AUTH-005, `docs/architecture/authentication.md` §10).
- The helpers are the enforcement point for workspace isolation (REQ-WS-003 / REQ-GEN-001): any future workspace-scoped query must go through the membership boundary — never "query by client-provided id only" (`docs/architecture/database.md` §10).
- The dashboard layout resolves the user's workspace context so the application shell renders real session/user data instead of the hardcoded "John Doe / Administrator" values.
- Do not implement role-based permission checks for CRM operations here; those belong to their feature implementations. This task only establishes the identity + membership boundary the Authentication feature requires.

**Dependencies**

- Task 3 (session), Task 2 (membership queries).

**Verification**

- Unit/integration test: `getCurrentUser` returns `null` when unauthenticated; `requireUser` redirects.
- Isolation test: membership resolution returns only memberships belonging to the authenticated user; a fabricated/foreign workspace id cannot be resolved.
- Negative test: no client-provided identity/role is ever read by these helpers.
- `pnpm typecheck` and `pnpm lint` pass.

### Task 9: Authentication UI

**Purpose**

Provide the login and registration pages and forms using the project's design tokens, with validation feedback, error display, and loading states (REQ-AUTH-005, REQ-GEN-003/004).

**Files**

- `src/app/(auth)/login/page.tsx` (new) — server component rendering the login form.
- `src/app/(auth)/register/page.tsx` (new) — server component rendering the registration form.
- `src/app/(auth)/layout.tsx` (new) — shared layout for public auth pages (optional; keeps auth pages visually consistent).
- `src/features/auth/components/LoginForm.tsx` (new) — client component: fields (email, password), submit, pending state (React `useActionState`/`useTransition`), inline error display from the server action.
- `src/features/auth/components/RegisterForm.tsx` (new) — client component: fields (email, password per Task 4 proposal), submit, pending state, inline error display.
- Design tokens only — no hardcoded colors/typography (AGENTS.md, `src/app/globals.css`). If no form-control tokens exist, use the existing token set and Tailwind primitives consistently; do not invent new design values.

**Changes**

- Login page: email + password inputs, submit button with loading state, link to `/register`, error display for invalid credentials.
- Register page: email + password inputs, submit button with loading state, link to `/login`, error display for validation failures and duplicate accounts.
- Forms use server actions from Task 4/5; client components stay thin (collect input, show state/errors).
- Preserve `callbackUrl` from middleware (Task 7) so login/registration redirect to the originally requested protected page when present.

**Dependencies**

- Tasks 4–6 (actions), Task 7 (redirect targets).

**Verification**

- Manual + E2E: register → redirected to dashboard; login → dashboard; invalid input shows inline errors; buttons show pending state during submit.
- `pnpm typecheck` and `pnpm lint` pass.

### Task 10: Application shell integration

**Purpose**

Wire the authenticated user into the application shell and expose logout (REQ-AUTH-003).

**Files**

- `src/app/components/layout/Sidebar.tsx` (modified) — render the real user email/name from server context (passed from `(dashboard)/layout.tsx`, Task 8) instead of hardcoded values; add a logout control.
- `src/app/components/layout/Topbar.tsx` (modified, optional) — remove placeholder stub if it remains unused; do not introduce new UI beyond what the shell needs.
- `src/app/(dashboard)/layout.tsx` (modified) — pass session/workspace context down to the shell components.

**Changes**

- The shell receives the authenticated user's email (and workspace context from Task 8) as props from the server layout.
- A logout button triggers `logoutAction` (Task 6) and redirects to `/login`.
- Keep changes minimal: no new navigation structure, no redesign; only replace the hardcoded user block and add the logout control.

**Dependencies**

- Task 6 (logout), Task 8 (server context).

**Verification**

- Manual: after login, the sidebar shows the real account email; logout returns to `/login`; protected pages are no longer accessible.
- `pnpm typecheck` and `pnpm lint` pass.

### Task 11: Tests

**Purpose**

Cover the critical authentication flows with automated tests, satisfying the feature spec Definition of Done ("Automated tests cover critical authentication flows") and mapping every acceptance criterion to a test.

**Files**

- `vitest.config.ts` (new) — Vitest configuration (or the chosen framework; see Open Questions — no test framework exists in the repo).
- `src/features/auth/**/*.test.ts` (new) — unit and integration tests.
- E2E tests (new, if Playwright is approved) — `e2e/auth.spec.ts` or equivalent.
- `package.json` — add `"test"` script (e.g., `vitest run`).

**Changes**

- Test infrastructure: a test database strategy must be defined (e.g., dedicated test database URL; each test run migrates/reseeds). This is an implementation decision requiring approval because no test stack exists (Open Questions).
- Unit tests:
  - Zod schemas: invalid email, weak/short password, missing fields, trimming/normalization.
  - Password hashing round-trip.
  - Credentials provider `authorize()` (single source of truth): valid credentials → `{ id, email }`; wrong password and unknown email → `null` (identical outcomes; no account-existence disclosure).
  - Session helper behavior (`getCurrentUser` null/redirect).
- Integration tests (against a test database):
  - Registration: user + workspace + OWNER membership created atomically (AC-AUTH-001).
  - Duplicate registration rejected with safe error, including the concurrent-insert race (AC-AUTH-002).
  - Login success: `loginAction` delegates to `signIn` → session established, redirect (AC-AUTH-003).
  - Login failure (wrong password, unknown email) yields the same generic error and no session (AC-AUTH-004).
  - Logout terminates the session; protected route then redirects to `/login` (AC-AUTH-006).
  - Protected-route redirect for unauthenticated users (AC-AUTH-005).
  - Workspace isolation: membership resolution is scoped to the authenticated user; a membership for another user cannot be resolved through the boundary.
  - Server-side enforcement: no client-supplied user id/role is used in authorization decisions (BR-AUTH-005).
- E2E tests (if approved): full register→dashboard, login→dashboard, logout→login, direct protected-URL access.
- Edge cases from feature spec §10: repeated registration submission, repeated login submission, direct protected-route access, access after logout, expired/invalid session.

**Dependencies**

- Tasks 4–10 (implementation under test), Task 1 (env/test DB config).

**Verification**

- `pnpm test` passes.
- Every acceptance criterion in `docs/features/authentication.md` §9 maps to at least one passing test.

### Task 12: Validation and verification

**Purpose**

Run the full verification checklist before implementation is considered complete (AGENTS.md "Validation", feature spec Definition of Done).

**Files**

- None (verification only; fix any defects surfaced in Tasks 1–11 files).

**Changes**

- Run and fix until green:
  - `pnpm typecheck` (TypeScript strict).
  - `pnpm lint` (ESLint).
  - `pnpm test` (test suite from Task 11).
  - `pnpm build` (production build).
  - Manual smoke test of register → login → logout against the dev server.
- Confirm the final diff touches only files listed in Tasks 1–11 (AGENTS.md Definition of Done: no unrelated functionality).

**Dependencies**

- All prior tasks.

**Verification**

- Verification checklist in section 9 is fully satisfied.

## 6. Database Changes

### New models (additive only)

| Model | Fields | Constraints / Relations |
|---|---|---|
| `User` | `id`, `email`, `passwordHash`, `createdAt`, `updatedAt` | `email` unique (BR-AUTH-001); 1:N `Membership` |
| `Workspace` | `id`, `name` (default `"My Workspace"` — see Open Questions), `createdAt`, `updatedAt` | 1:N `Membership` |
| `Membership` | `id`, `userId`, `workspaceId`, `role`, `createdAt`, `updatedAt` | `@@unique([userId, workspaceId])`; FKs with `onDelete: Cascade`; `@@index([workspaceId])`, `@@index([userId])` |
| `Role` (enum) | `OWNER`, `MANAGER`, `MEMBER` | Postgres enum via Prisma |

### Migration

- Generate the initial migration (`prisma migrate dev --name init_authentication` or the equivalent command for the installed Prisma 8 RC CLI) and review the SQL.
- The migration is **non-destructive**: it creates new tables and an enum only. No existing table is altered or dropped.
- `passwordHash` stores only the bcrypt hash; plaintext passwords never touch the database.

### Data integrity considerations

- Registration creates `User` + `Workspace` + `Membership(OWNER)` in one Prisma transaction so a failure cannot leave a user without a workspace (REQ-WS-001, BR-AUTH-002).
- Unique constraint on `Membership(userId, workspaceId)` enforces one membership per user per workspace at the database level (database.md §13).
- Unique constraint on `User.email` enforces account identity (BR-AUTH-001) and backs duplicate-registration detection.
- Cascade deletes on memberships keep referential integrity if a user or workspace is ever removed; deletion flows are not part of this feature.

## 7. Authorization & Security

### Authentication requirements

- Sessions established and verified exclusively through Auth.js (`src/auth.ts`); protected routes require a valid session (REQ-AUTH-004).
- Session payload is minimal: user `id` and `email` only. No password hash, no role, no workspace data in the session/token (`docs/architecture/authentication.md` §8).
- Credentials are verified in exactly one place — the Auth.js Credentials provider `authorize()` (single source of truth). Login never verifies credentials outside that path: `loginAction` validates format, delegates to `signIn()`, and maps the outcome; there is no `loginUser` service that compares hashes. Registration hashes a new password (bcrypt) but never verifies one. Password comparison uses bcrypt (`bcryptjs` or approved alternative).

### Authorization requirements

- Authentication does not grant authorization (BR-AUTH-004): after identifying the user, the application resolves the workspace and membership server-side before any workspace-scoped access (`docs/architecture/authentication.md` §9).
- Client-provided user identity, workspace identity, and role are never trusted (BR-AUTH-005, `docs/architecture/architecture.md` §14).
- This plan implements the identity + membership boundary only. Role-based permission checks for CRM operations are not implemented here (they belong to the Customer/Deal/Activity/Team features) — but the boundary helpers in Task 8 are the enforcement point future features must use.

### Workspace isolation

- Membership resolution is scoped to the authenticated user; a user can only resolve memberships they own (REQ-WS-003, REQ-GEN-001).
- The anti-pattern in `docs/architecture/database.md` §10 (query by client-provided id without a workspace boundary) is never used.

### Validation

- All auth input is validated with Zod at the server boundary (REQ-GEN-002, `docs/architecture/architecture.md` §8): email format, password policy, required fields.
- Client-side validation may be added for UX but is never a security boundary.

### Security-sensitive failure cases

- Invalid credentials → single generic message; no account-existence disclosure (`docs/architecture/authentication.md` §5).
- Duplicate registration → safe duplicate-account error, mapped from both pre-check and the `P2002` unique-constraint race (AC-AUTH-002).
- Missing/invalid session → redirect to `/login` (AC-AUTH-005, feature spec §8).
- Unexpected failures → generic error; no implementation details, stack traces, or DB errors exposed (REQ-GEN-003, feature spec §8).
- `AUTH_SECRET` and `DATABASE_URL` come from env; nothing secret is committed (`.env*` ignored).

## 8. Testing Plan

Tests are derived from the acceptance criteria (feature spec §9), business rules (§5), and error cases (§8). Framework choice requires approval (Open Questions); Vitest is the recommended unit/integration runner, with Playwright optional for E2E.

| Acceptance criterion / rule | Test |
|---|---|
| AC-AUTH-001 (registration creates account + workspace + OWNER + authenticated + redirect) | Integration test asserting User, Workspace, Membership(OWNER) rows and session; E2E register→dashboard |
| AC-AUTH-002 (duplicate registration rejected, safe error) | Sequential duplicate test; concurrent duplicate test mapping unique-constraint error |
| AC-AUTH-003 (valid login → session + redirect) | Integration test exercising `loginAction` → Auth.js `signIn` → provider `authorize()`; E2E login→dashboard |
| AC-AUTH-004 (invalid login fails, protected resources inaccessible) | Wrong password / unknown email → `authorize()` returns `null` in both cases → `loginAction` returns the same generic error, no session, protected route redirects |
| AC-AUTH-005 (unauthenticated protected route denied/redirected) | Middleware/layout redirect tests for `/dashboard`, `/customers`, `/deals`, `/activities`, `/team`, `/settings` |
| AC-AUTH-006 (logout terminates session) | Session cleared; protected route requires auth again |
| BR-AUTH-001 (unique account identity) | Duplicate email rejected (DB constraint + application mapping) |
| BR-AUTH-002 (first membership is OWNER) | Registration integration test asserts role `OWNER` |
| BR-AUTH-003 (no unauthenticated protected access) | Covered by AC-AUTH-005 tests |
| BR-AUTH-004/005 (no implicit authorization; no client-trusted identity/role) | Negative tests: helpers ignore client-supplied identity/role; foreign workspace/membership cannot be resolved |
| Single source of truth — one credential-verification path (plan invariant) | Structural check: hash comparison exists only in `authorize()`; `loginAction` delegates to `signIn` and performs no hash comparison; unit tests for the provider (valid, wrong password, unknown email) |
| Validation rules §7 | Schema unit tests: invalid email, short password, missing fields, normalization |
| Error cases §8 | Tests for each: invalid input, duplicate, invalid credentials, missing credentials, expired/invalid session, unauthorized access, unexpected failure (assert no sensitive detail leaks) |
| Edge cases §10 | Repeated submission, direct protected-route access, access after logout, expired session |

Test data strategy (to be finalized with the test-framework approval): a dedicated test database (separate `DATABASE_URL`) migrated before each run; tests never touch the development database.

## 9. Verification Checklist

- [ ] `pnpm typecheck` passes (TypeScript strict)
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (all acceptance criteria covered)
- [ ] `pnpm build` passes (production build)
- [ ] Acceptance criteria AC-AUTH-001..006 verified
- [ ] Authorization boundary verified (server-side, no client trust)
- [ ] Workspace isolation verified (membership scoped to authenticated user)
- [ ] Protected routes verified (middleware + layout guard)
- [ ] Validation verified (server-side Zod at the boundary)
- [ ] No unrelated files changed
- [ ] No unnecessary dependencies added
- [ ] Final diff reviewed

## 10. Risks & Open Questions

These are genuine, unresolved items. The plan proceeds on the proposed defaults below; each needs explicit confirmation before implementation starts.

1. **Workspace display name (product-level, unspecified).** No specification defines what the initial workspace is called or whether the user provides a name. Proposed default: registration collects only email + password (per feature spec §7) and the workspace is created with the default name `"My Workspace"`. Alternative: collect a workspace name during registration (adds a form field not present in any spec). Decision required — the choice affects the schema (`name` column semantics) and the registration form.
2. **Registration form fields.** The spec requires email + password and "all required fields" without enumerating them. Proposed: email + password only (no display name, no workspace name, no password-confirmation field). Confirmation required.
3. **Password policy.** The spec explicitly delegates exact password requirements to implementation ("without weakening the security requirements"). Proposed: minimum 8 characters. This is a user-visible policy; confirm before implementation.
4. **Test framework (no test stack exists).** The repo has no test runner, no test config, and no test script, yet the feature DoD requires automated tests. Introducing Vitest (recommended, unit + integration) and/or Playwright (E2E) is a new dependency and must be approved. Test-database strategy (separate Postgres database) is part of this decision.
5. **Dependency additions.** `next-auth` and `zod` are mandated by the architecture but are not installed (zod is only transitive). `bcryptjs` is proposed for password hashing; alternative is Node's built-in `crypto.scrypt` (no new dependency). All three additions require approval under AGENTS.md ("Do not introduce new libraries without a clear reason" — the reasons are documented above).
6. **Session strategy and revocation.** JWT sessions (Auth.js default) are proposed: no database adapter, no extra Session/Account tables, logout destroys the session cookie. Limitation: an already-issued JWT cannot be revoked server-side before it expires. Database-backed sessions would allow revocation but add tables and are not required by any spec. Confirm the JWT approach is acceptable.
7. **Post-login / post-registration redirect target.** Spec says "redirect to the appropriate protected application area." Proposed: `/dashboard` (exists today and is the natural landing area per REQ-DASH-001). Confirm.
8. **Root `/` route behavior.** Unspecified. Proposed: authenticated → `/dashboard`, unauthenticated → `/login`. Confirm.
9. **Authenticated users visiting `/login` or `/register`.** Unspecified. Proposed: redirect to `/dashboard`. Confirm (or leave as-is).
10. **Environment file location.** `.env/.env.dev` is not auto-loaded by Next.js or the Prisma CLI, and its contents could not be verified by the planning agent (file read blocked). Task 1 must verify/wire env loading (`DATABASE_URL`, `AUTH_SECRET`). Minor risk: the Prisma 8 RC CLI (`8.0.0-rc.12`) paired with `@prisma/client` `7.10.0` may require specific env/config handling — verify during Task 1/2.
11. **Repository inconsistencies (non-blocking, reported).** No Prisma schema or migrations exist despite the database architecture; placeholder pages use raw typography classes instead of design tokens; README documents npm/yarn/bun while the project uses pnpm; `pnpm` appears as a dependency in `package.json`; no `typecheck`/`test` scripts exist. None conflict with the specifications; they are gaps the plan addresses (schema/migration in Task 2, typecheck script in Task 1, token usage in Task 9) or minor documentation issues left untouched (out of scope).
12. **Prisma Composer skill is not applicable.** The bundled `prisma-composer` agent skill describes a workflow (Composer modules, `contract.prisma`, `prisma-composer deploy`) that this repository does not use. Implementers must follow the classic Prisma schema + migration workflow per `docs/architecture/database.md`.

## 11. Scope Confirmation

`NEEDS_APPROVAL`

The plan can be executed without further product or architecture decisions **only after** the open questions in section 10 are resolved (workspace naming, registration fields, password policy, test framework introduction, dependency additions, session strategy). None of these block conformance with the specifications — every decision above has a proposed default that satisfies the requirements — but each is a user-visible or dependency-level choice that requires explicit approval per `AGENTS.md` and the plan lifecycle in `docs/plans/README.md` ("A plan must be reviewed and explicitly approved before implementation begins"). Once the open questions are confirmed, the plan is executable end-to-end without additional decisions.