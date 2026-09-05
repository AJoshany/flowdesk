# Implementation Plan: Workspace

## 1. Objective

Implement the Workspace feature defined in `docs/features/workspace.md` on top of
the already-implemented Authentication feature:

- Server-side workspace access for authenticated members (AC-WS-001).
- Denial of access for authenticated users without membership (AC-WS-002).
- Cross-workspace isolation: members of one workspace cannot access another
  workspace's data (AC-WS-003).
- A reusable server-side authorization boundary that future CRM features
  (Customers, Deals, Activities, Team) must route workspace-scoped queries
  through, per `docs/architecture/database.md` §10.

The feature does not add new UI, workspace switching, member management, or
CRM resources. It formalizes and hardens the workspace boundary introduced by
Authentication, reusing the existing schema and session helpers.

## 2. Scope

### In Scope

- A `src/features/workspace/` feature module:
  - Workspace membership data access (server-side, Prisma only).
  - `requireWorkspaceAccess(userId, workspaceId)` — the authorization
    boundary: grants only when the *authenticated* user holds membership in
    the target workspace; denies otherwise.
  - Session + workspace composition helpers for server components
    (`getSessionWorkspace`, `requireSessionWorkspace`) built on the existing
    Authentication session helpers.
  - An OWNER-invariant verification helper (BR-WS-002).
- Tighten the dashboard shell guard: authenticated users without a workspace
  membership are denied (404), not shown the shell.
- Tests for the acceptance criteria and the security checklist (isolation,
  non-member rejection, role workspace-scoping, no client-trusted
  identity/role, OWNER membership).

### Out of Scope

- Workspace switching / multi-workspace UX (MVP has a primary workspace).
- Workspace settings / rename UI (not specified).
- Member management (list/invite/role change/removal) — Team feature.
- Customers, Deals, Activities — their own feature specifications.
- New database models or migrations (the Authentication schema already
  provides `User`, `Workspace`, `Membership`, `Role`).
- Redesign or replacement of the Authentication implementation.

## 3. Existing Repository Analysis

### Database

- `prisma/schema.prisma` already defines `Role` (OWNER/MANAGER/MEMBER),
  `User`, `Workspace`, `Membership` with `@@unique([userId, workspaceId])`,
  cascade deletes, and indexes — all per `docs/architecture/database.md`.
- No database changes are required for this feature.

### Authentication infrastructure (reused, not redesigned)

- `src/auth.ts` / `src/auth.config.ts` — Auth.js v5 (Credentials provider is
  the single source of truth for credential verification).
- `src/features/auth/session.ts` — server-side helpers:
  - `getCurrentUser()` / `requireUser()` (session → user id/email).
  - `getWorkspaceContext(userId)` — primary workspace context
    (`{ workspaceId, workspaceName, role }`).
  - `requireWorkspaceMembership(userId, workspaceId?)` — note: redirects to
    `/login` when membership is missing, which is appropriate for unauthenticated
    users but the wrong denial for an *authenticated non-member*.
- `src/features/auth/services.ts` — `registerUser` transactionally creates
  User + Workspace + OWNER Membership (the only membership creation path today).
- `src/features/auth/actions.ts` — login/register/logout server actions.

### Application shell

- `src/app/(dashboard)/layout.tsx` — server layout that calls
  `requireUser()` + `getWorkspaceContext()` and renders `<Sidebar />` with the
  user email and workspace name. Membership is currently optional; the shell
  renders even when the authenticated user has no workspace.
- `src/app/(dashboard)/dashboard|customers|settings/page.tsx` — placeholders.
- `src/middleware.ts` — edge-runtime auth redirects (protected routes).

### Tests / tooling

- Vitest with a dedicated test database (`flowdesk_test`) provisioned in
  `tests/global-setup.ts`; DB integration tests live under
  `src/features/**/*.test.ts`; HTTP end-to-end tests live in `tests/`.

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| BR-WS-001 (user belongs to a workspace via membership) | Reuse `Membership` + registration flow; workspace service | Integration test: registered user has an OWNER membership |
| BR-WS-002 (every workspace has ≥1 OWNER) | `countWorkspaceOwners` helper; registration is the only mutation | Integration test: workspace created by registration has exactly one OWNER; adding other-role memberships cannot remove it |
| BR-WS-003 (workspace resources belong to exactly one workspace) | Boundary queries keyed by `(userId, workspaceId)`; no resource-by-id-only queries | Isolation tests assert scoped results |
| BR-WS-004 / AC-WS-001 (members may access their workspace) | `requireWorkspaceAccess` / `requireSessionWorkspace` | Integration test: OWNER membership grants access |
| AC-WS-002 (authenticated user without membership is denied) | `requireWorkspaceAccess` → `notFound()`; shell guard | Integration/unit tests: denial, no shell render |
| AC-WS-003 / BR-WS-005 (cross-workspace isolation, server-side) | Authorization boundary enforced in server code only | Tests: member of B cannot access A's membership/workspace data |
| Client-provided identity/role never trusted | Boundary API accepts only session-derived userId (+ target workspaceId); no role input | Negative tests: role comes from DB only; foreign/absent workspace denied |
| Role is workspace-scoped | Query returns role per (userId, workspaceId) | Test: same user OWNER in one workspace, MEMBER in another |
| Error cases §6 (workspace does not exist, not a member, invalid membership) | `notFound()` denial; unique membership constraint | Tests for nonexistent workspace id, non-member, empty/malformed id |
| DoD (tests, typecheck, lint) | Workspace test suite | Verification checklist (section 9) |

## 5. Implementation Tasks

Tasks are ordered by dependency.

### Task 1: Workspace feature module — types and data access

**Purpose**

Provide the server-side data layer for workspace membership queries, scoped
strictly by (authenticated user, workspace) pairs.

**Files**

- `src/features/workspace/types.ts` (new)
- `src/features/workspace/service.ts` (new, server-only, Prisma)

**Changes**

- `types.ts`:
  - `WorkspaceRole = "OWNER" | "MANAGER" | "MEMBER"` (mirrors the Prisma enum).
  - `WorkspaceMembership = { workspaceId: string; role: WorkspaceRole }`.
- `service.ts`:
  - `findWorkspaceMembership(userId, workspaceId)` → `WorkspaceMembership | null`
    via `prisma.membership.findUnique({ where: { userId_workspaceId } })`.
    Returns only `{ workspaceId, role }` — never other workspace data.
  - `countWorkspaceOwners(workspaceId)` → number of `OWNER` memberships
    (BR-WS-002 invariant check; used by tests now and by future Team-feature
    mutations that must never remove the last OWNER).
  - Both functions take the identity as an argument; callers obtain `userId`
    exclusively from the server-side session.

**Dependencies**

- None (reuses `src/lib/prisma.ts`).

**Verification**

- `pnpm typecheck` passes.
- Integration tests in Task 4 cover scoped queries and null results.

### Task 2: Authorization boundary — `requireWorkspaceAccess`

**Purpose**

Implement AC-WS-002/AC-WS-003 and the `docs/architecture/database.md` §10
boundary: grant access to a workspace only when the authenticated user holds
membership in it; deny (404, no existence disclosure) otherwise. This is the
guard every future workspace-scoped operation goes through.

**Files**

- `src/features/workspace/access.ts` (new)

**Changes**

- `requireWorkspaceAccess(userId, workspaceId)`:
  1. `findWorkspaceMembership(userId, workspaceId)`.
  2. If `null` → `notFound()` (deny; does not reveal whether the workspace
     exists, and avoids the login-redirect loop of `requireWorkspaceMembership`
     for authenticated non-members).
  3. Returns `WorkspaceMembership`.
- Denial policy documented in code: unauthenticated → login redirect (handled
  upstream by auth helpers/middleware); authenticated non-member → 404.

**Dependencies**

- Task 1.

**Verification**

- Integration tests: member granted (AC-WS-001); non-member denied (AC-WS-002);
  cross-workspace denied (AC-WS-003); nonexistent workspace denied.

### Task 3: Session + workspace composition for server components

**Purpose**

Give server components a single, safe entry point that resolves the
authenticated user AND their workspace server-side, reusing the existing
Authentication helpers (`docs/architecture/authentication.md` §11).

**Files**

- `src/features/workspace/session-workspace.ts` (new)
- `src/app/(dashboard)/layout.tsx` (modified)

**Changes**

- `session-workspace.ts`:
  - `getSessionWorkspace()` → `{ user, workspace } | null` (no session or no
    membership → `null`) using `getCurrentUser` + `getWorkspaceContext`.
  - `requireSessionWorkspace()` → `{ user, workspace }`; unauthenticated →
    redirect to `/login` (via `requireUser`); authenticated without membership →
    `notFound()` (AC-WS-002 denial at the shell).
- `(dashboard)/layout.tsx`: replace `requireUser()` + `getWorkspaceContext()`
  with `requireSessionWorkspace()`. Behavior for all real flows is unchanged
  (registration always creates membership); authenticated users without a
  membership now receive a denial instead of the shell.

**Dependencies**

- Task 1 (types), existing auth session helpers.

**Verification**

- Unit tests with mocked auth session helpers: null / object / redirect /
  notFound paths.
- `pnpm typecheck` and `pnpm lint`.

### Task 4: Tests

**Purpose**

Cover the acceptance criteria, business rules, error cases, and the security
checklist requested for this feature.

**Files**

- `src/features/workspace/service.test.ts` (new, DB integration)
- `src/features/workspace/access.test.ts` (new, DB integration)
- `src/features/workspace/session-workspace.test.ts` (new, mocked auth)

**Changes**

- Service tests (against the dedicated test DB):
  - Registered user has exactly one OWNER membership in their workspace
    (BR-WS-001, BR-WS-002, AC-WS-001).
  - Non-member lookup → `null`; nonexistent workspace id → `null`.
  - `countWorkspaceOwners` = 1 after registration; adding members of other
    roles keeps ≥1 OWNER; OWNER role is not inferred across workspaces.
  - Role is workspace-scoped: the same user is OWNER in one workspace and
    MEMBER in another; queries return the per-workspace role.
- Access tests:
  - Member granted (AC-WS-001); non-member denied via `notFound()`
    (AC-WS-002); member of workspace B requesting workspace A denied
    (AC-WS-003); nonexistent workspace denied; empty/malformed id denied.
  - No client-provided role/identity input exists in the API; the returned
    role always comes from the DB row keyed by (session userId, workspaceId).
- Session-workspace tests (mocked `@/features/auth/session`):
  - `getSessionWorkspace` → `null` (unauthenticated), `null` (no membership),
    `{ user, workspace }` otherwise.
  - `requireSessionWorkspace` → login redirect (unauthenticated), `notFound`
    (no membership), composed result otherwise.

**Dependencies**

- Tasks 1–3.

**Verification**

- `pnpm test` passes.

### Task 5: Validation and verification

**Purpose**

Run the full verification checklist.

**Files**

- None (verification only).

**Changes**

- Run and fix until green: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`.
- Confirm the diff only touches files listed in Tasks 1–4 plus the pre-existing
  type-only fix in `tests/auth.http.e2e.test.ts` required to make the baseline
  typecheck pass.

**Dependencies**

- All prior tasks.

**Verification**

- Checklist in section 9 satisfied.

## 6. Database Changes

**No database changes required.**

`User`, `Workspace`, `Membership`, and `Role` already exist from the
Authentication feature and fully satisfy the Workspace requirements
(`Membership.userId/workspaceId/role`, `@@unique([userId, workspaceId])`,
cascade FKs, indexes). No migration is generated. BR-WS-002 is structurally
guaranteed today (registration is the only membership-creation path and always
creates an OWNER) and is protected for future Team-feature mutations by the
`countWorkspaceOwners` invariant helper.

## 7. Authorization & Security

### Authentication requirements

- Identity always comes from the server-side Auth.js session via the existing
  `src/features/auth/session.ts` helpers (`requireUser` / `getCurrentUser`).
- Unauthenticated access to protected areas continues to be handled by
  middleware + the dashboard layout (redirect to `/login`).

### Authorization requirements

- `requireWorkspaceAccess(userId, workspaceId)` is the server-side boundary:
  access is granted only when `prisma.membership` contains a row for
  `(sessionUserId, workspaceId)`.
- Denial is explicit: authenticated non-members receive `notFound()` (404) —
  no login loop, no disclosure of whether a workspace exists.
- Client-provided `userId`, `workspaceId`, and `role` are never trusted for
  authorization decisions. The only inputs to the boundary are the
  session-derived user id and the target workspace id; `role` is never an
  input — it is read from the membership row.
- The anti-pattern in `docs/architecture/database.md` §10 (query a resource by
  client id only, without the workspace boundary) is not used anywhere.

### Workspace isolation

- Membership queries are keyed by `(userId, workspaceId)`; a user can only
  resolve memberships they own (BR-WS-004/005).
- Role is workspace-scoped: resolution always returns the role stored on the
  specific `(userId, workspaceId)` membership (database.md §5).

### Validation

- This feature exposes no client input forms. `requireWorkspaceAccess`
  defensively treats missing/non-string workspace ids as a denial.

### Security-sensitive failure cases

- Non-member / nonexistent workspace / foreign workspace id → `notFound()`.
- No membership or workspace data is returned to unauthorized callers.
- Errors never expose internal identifiers beyond what the caller is
  authorized to see.

## 8. Testing Plan

| Criterion | Test |
|---|---|
| AC-WS-001 (member access granted) | `requireWorkspaceAccess(owner, ownWorkspace)` returns OWNER membership; `requireSessionWorkspace` composes session + workspace |
| AC-WS-002 (non-member denied) | Authenticated user without membership in target workspace → `notFound`; `findWorkspaceMembership` → null |
| AC-WS-003 (cross-workspace denied) | Member of workspace B requesting workspace A's membership/workspace data → denied |
| BR-WS-001 (membership exists) | Registration yields exactly one OWNER membership |
| BR-WS-002 (≥1 OWNER) | `countWorkspaceOwners` = 1 after registration; stays 1 when other-role members are added |
| BR-WS-004/005 (server-side isolation, no client trust) | Boundary inputs are (session userId, workspaceId) only; role read from DB; foreign ids denied |
| Role workspace-scoped | Same user: OWNER in workspace 1, MEMBER in workspace 2 → per-workspace roles returned |
| Error cases §6 | Nonexistent workspace, non-member, empty/malformed workspace id |
| Session-workspace helpers | Mocked auth: unauthenticated → null/redirect; member → composed context; no-membership → null/notFound |

## 9. Verification Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new workspace tests + full suite)
- [ ] `pnpm build` passes
- [ ] AC-WS-001..003 verified
- [ ] Non-member rejection verified (authenticated, no membership)
- [ ] Cross-workspace isolation verified
- [ ] OWNER membership + ≥1 OWNER verified
- [ ] Role workspace-scoping verified
- [ ] No client-trusted identity/role verified
- [ ] No unrelated files changed

## 10. Risks & Open Questions

1. **No product-facing workspace page.** The spec defines access/isolation
   rules, not UI. Enforcement surfaces are the protected app shell and the
   reusable boundary for future CRM features. If a visible "workspace" screen
   is wanted, it needs a product decision (out of scope here).
2. **BR-WS-002 enforcement point.** No member-removal or role-change flow
   exists yet (Team feature). The invariant is structural today; the
   `countWorkspaceOwners` helper is the guard future mutations must use.
3. **Denial semantics.** Authenticated non-members are denied with `notFound()`
   (404). This was chosen over a redirect to avoid login loops and workspace
   existence disclosure; it matches the "access is denied" wording of the
   acceptance criteria.

## 11. Scope Confirmation

`READY_FOR_IMPLEMENTATION`

The plan introduces no product or architecture decisions: it reuses the
Authentication schema/session helpers, adds no database changes, and restricts
the feature to server-side access/isolation enforcement plus tests. The plan
is treated as approved for this task and is implemented in the same session.
