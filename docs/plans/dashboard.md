# Implementation Plan: Dashboard

## 1. Objective

Implement the Dashboard feature on top of the existing Authentication,
Workspace, Customers, Deals, Activities, and Team implementations:

- Dashboard access for authenticated workspace members (REQ-DASH-001) — the
  access boundary already exists (middleware + `(dashboard)` layout); the
  page itself will use the same server-resolved session workspace.
- CRM overview (REQ-DASH-002): workspace-scoped counts for the four core CRM
  domains — customers, deals, activities, and team members.
- Sales overview (REQ-DASH-003): the current state of the sales pipeline
  (deal counts per pipeline stage).
- Activity overview (REQ-DASH-004): the most recent workspace activities.

The Dashboard is an aggregation/read layer over the existing domain
functionality. No new business rules, no new CRM entities, no new
permissions, and no client-side data fetching are introduced.

## 2. Scope

### In Scope

- `src/features/dashboard/service.ts`: a single server-side aggregation
  function (`getDashboardData(workspaceId)`) that returns the overview data
  using database-side queries (`count` / `groupBy`) scoped to the authorized
  workspace, parallelized with `Promise.all`.
- `src/features/activities/service.ts`: new `listRecentActivities(workspaceId,
  take)` — a small, workspace-scoped read helper reused by the dashboard
  (keeps activity query logic in the Activities feature).
- `/dashboard` page (server component) with:
  - Header + workspace name.
  - Getting-started panel when the workspace has no customers, deals, or
    activities (minimal/new workspace).
  - CRM overview: four stat cards (Customers, Deals, Activities, Team
    members), each linking to its domain page.
  - Sales pipeline section: deal count per stage (NEW, QUALIFIED, PROPOSAL,
    WON, LOST), zero-filled, with an empty note when there are no deals.
  - Recent activity section: the 5 most recent workspace activities
    (reused `ActivityList`), with an empty note when there are none.
- `src/features/dashboard/components/`: `StatCard`, `PipelineOverview`,
  `DashboardEmptyNote`, `GettingStartedPanel`.
- Loading state (`/dashboard/loading.tsx`, skeleton — existing pattern) and
  error state (`/dashboard/error.tsx`, client error boundary with retry).
- Tests: dashboard aggregation service (integration, test DB) + recent
  activity limit/scoping tests in the Activities test suite.

### Out of Scope

- Advanced reporting, custom reports, export, forecasting, AI, notifications,
  automation, and any metric not required by the product spec (e.g. win
  rates, conversion, revenue, trends, charts).
- New CRM entities and new business rules.
- Client-side fetching / state-management libraries / caching layers.
- Changes to Customers, Deals, Activities, or Team UI (the only cross-feature
  change is the new read helper `listRecentActivities` in the Activities
  service).
- Redesign of unrelated pages or of the app shell.
- Workspace switching, dashboard-level query parameters or filters (none are
  specified), and dashboard-specific permissions (none are defined).

## 3. Existing Repository Analysis

- **Auth/session** (`src/features/auth/session.ts`, `src/auth.ts`): Auth.js
  JWT session carrying only `{ id, email }`; role is never stored in the
  token.
- **Workspace boundary** (`src/features/workspace/session-workspace.ts`):
  `requireSessionWorkspace()` returns `{ user, workspace: { workspaceId,
  workspaceName, role } }` — identity + membership + role resolved
  server-side (unauthenticated → `/login` redirect, authenticated non-member
  → 404). Every protected page uses it; the `(dashboard)` layout already
  calls it, and middleware protects `/dashboard*`. **Nothing new is needed
  for REQ-DASH-001.**
- **Domain services** (server-only, Prisma): `listCustomers`,
  `listDeals`/`getDealById`, `listActivities`/`listActivitiesForCustomer`/
  `listActivitiesForDeal`, `listTeamMembers` — all keyed by the authorized
  `workspaceId`, never "by id only" (`docs/architecture/database.md` §10).
- **Schema** (`prisma/schema.prisma`): `Customer`, `Deal` (with
  `DealStage` enum NEW/QUALIFIED/PROPOSAL/WON/LOST), `Activity`, `Membership`
  — every CRM row carries `workspaceId`. **All dashboard data already
  exists; no schema change is required.**
- **UI system**: Server Components by default; design tokens in
  `src/app/globals.css` (`text-h4`, `text-h6`, `text-body-*-*`,
  `border-border`, `bg-white`, `bg-primary-accent`, `text-body-light`,
  `text-heading`); `DealStageBadge` (stage colors) and `ActivityList`
  (activity rows with customer/deal links) are directly reusable; empty-state
  card pattern from `customers/page.tsx` / `deals/page.tsx`; loading
  skeleton pattern from `customers/loading.tsx` / `team/loading.tsx`.
- **Testing**: Vitest + dedicated test DB (`tests/global-setup.ts` truncates
  `Membership`/`Workspace`/`User` with CASCADE). Service tests seed via
  `registerUser` + domain services (`createCustomer`, `createDeal`,
  `createActivity`) and direct `prisma` inserts (see
  `src/features/activities/service.test.ts` helpers). No React component
  tests exist in the repo; behavior is verified at the service/action/
  session boundary, which this plan follows.

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| REQ-DASH-001 (authenticated member access) | existing middleware + `(dashboard)` layout + `requireSessionWorkspace` on the page | existing `session-workspace` tests; service tests keyed by server-resolved workspace id |
| REQ-DASH-002 (CRM overview) | `getDashboardData` counts + four stat cards | dashboard service tests |
| REQ-DASH-003 (sales pipeline overview) | `deal.groupBy({ by: ["stage"] })` + `PipelineOverview` | dashboard service stage-count tests |
| REQ-DASH-004 (recent activity overview) | `listRecentActivities(workspaceId, 5)` + `ActivityList` | dashboard + activities tests |
| REQ-GEN-001 (data isolation) | every aggregation `where: { workspaceId }` from server context | cross-workspace isolation tests |
| REQ-GEN-002/003 (no user input; error handling) | no inputs/filters; `error.tsx` boundary + typed service | error boundary added; no validation needed (no inputs) |
| REQ-GEN-004 (loading states) | `/dashboard/loading.tsx` | skeleton follows existing pattern |
| REQ-GEN-005 (empty states) | getting-started panel + per-section empty notes | zeroed-workspace service test + manual UI check |
| REQ-GEN-006 (responsive) | grid + flexible layout using existing tokens | manual check |

## 5. Implementation Tasks

Tasks are ordered by dependency.

### Task 1: Recent-activity read helper (Activities)

**Purpose**

Expose the most recent workspace activities as a scoped read so the
Dashboard does not duplicate activity query logic or load the full feed.

**Files**

- `src/features/activities/service.ts` (modified)

**Changes**

- Add `listRecentActivities(workspaceId: string, take: number)`: reuses the
  existing `activitySelect` and the `{ workspaceId }` WHERE clause, ordered
  `createdAt desc`, `take` limited. Workspace-scoped like every other
  activity read (BR-ACT-005); a caller can only ever see its own
  workspace's activities.

**Dependencies**

- None.

**Verification**

- New tests in `src/features/activities/service.test.ts` (limit, ordering,
  isolation).

### Task 2: Dashboard aggregation service

**Purpose**

All Dashboard data access in one isolated, server-only, workspace-scoped
module (`src/features/dashboard/service.ts`). Counts are computed
database-side (no loading of large datasets), and the independent queries
run in parallel.

**Files**

- `src/features/dashboard/service.ts` (new)

**Changes**

- `export const RECENT_ACTIVITIES_LIMIT = 5`.
- `getDashboardData(workspaceId)` returns `{ customerCount, dealCount,
  activityCount, memberCount, dealsByStage, recentActivities }` where:
  - `customerCount = prisma.customer.count({ where: { workspaceId } })`
  - `dealCount = prisma.deal.count({ where: { workspaceId } })`
  - `activityCount = prisma.activity.count({ where: { workspaceId } })`
  - `memberCount = prisma.membership.count({ where: { workspaceId } })`
  - `dealsByStage = Record<DealStage, number>` built from
    `prisma.deal.groupBy({ by: ["stage"], where: { workspaceId }, _count: { _all: true } })`,
    zero-filled for every `DEAL_STAGES` entry so missing stages render as 0.
  - `recentActivities = listRecentActivities(workspaceId, RECENT_ACTIVITIES_LIMIT)`.
  - All six queries run inside `Promise.all`.
- Every query is keyed exclusively by the `workspaceId` the page resolves
  server-side from the session (`requireSessionWorkspace`) — the service
  never reads client input, so a client-supplied workspace/user/role can
  never reach it.

**Dependencies**

- Task 1.

**Verification**

- Integration tests (Task 5).

### Task 3: Dashboard UI components

**Purpose**

Small presentational components using the existing design tokens.

**Files**

- `src/features/dashboard/components/StatCard.tsx` (new)
- `src/features/dashboard/components/PipelineOverview.tsx` (new)
- `src/features/dashboard/components/DashboardEmptyNote.tsx` (new)
- `src/features/dashboard/components/GettingStartedPanel.tsx` (new)

**Changes**

- `StatCard`: `{ label, value, href }` — a `Link` card (border-border /
  bg-white / hover:bg-bg) with a body-regular-12 label and `text-h5` value
  (the four stat cards share this one component).
- `PipelineOverview`: `{ dealsByStage }` — one row per `DEAL_STAGES` entry:
  `DealStageBadge` + count (`text-body-medium-14`).
- `DashboardEmptyNote`: `{ title, message, href, ctaLabel }` — the existing
  empty-state card pattern with a primary CTA link.
- `GettingStartedPanel`: `{ customerHref, dealHref, activityHref }` — shown
  only for a minimal/new workspace; three CTAs into creation pages.

**Dependencies**

- Task 2 (types).

**Verification**

- Typecheck; rendered via the page (Task 4).

### Task 4: Dashboard page + loading/error states

**Purpose**

Replace the `/dashboard` placeholder with the spec-required overview,
server-rendered.

**Files**

- `src/app/(dashboard)/dashboard/page.tsx` (rewritten)
- `src/app/(dashboard)/dashboard/loading.tsx` (new)
- `src/app/(dashboard)/dashboard/error.tsx` (new)

**Changes**

- Page: `requireSessionWorkspace()` → `getDashboardData(workspace.workspaceId)`.
  Layout:
  - Header (`text-h4`) + workspace name subtitle (matches other pages).
  - Getting-started panel when `customerCount === 0 && dealCount === 0 &&
    activityCount === 0`.
  - "CRM overview": four `StatCard`s linking to `/customers`, `/deals`,
    `/activities`, `/team`.
  - "Sales pipeline" section: `PipelineOverview`, or `DashboardEmptyNote`
    (→ `/deals/new`) when `dealCount === 0`. "View all" link to `/deals`.
  - "Recent activity" section: `ActivityList` with the server-fetched recent
    activities, or `DashboardEmptyNote` (→ `/activities/new`) when there are
    none. "View all" link to `/activities`.
- `loading.tsx`: skeleton matching `customers/loading.tsx` / `team/loading.tsx`.
- `error.tsx`: `"use client"` error boundary ("Something went wrong" + retry
  via `reset()`), consistent with the design tokens. Isolated to the
  dashboard subtree (no other route is affected).
- No query parameters, no filters, no client-side fetching.

**Dependencies**

- Tasks 2–3.

**Verification**

- `pnpm typecheck` / `pnpm lint`; manual smoke of the populated and empty
  workspaces.

### Task 5: Tests

**Purpose**

Behavior tests for the aggregation layer and the activity read helper.

**Files**

- `src/features/dashboard/service.test.ts` (new, DB integration)
- `src/features/activities/service.test.ts` (modified — `listRecentActivities`
  cases)

**Changes**

- Dashboard service tests (seed via `registerUser` + existing domain
  services, mirroring `src/features/activities/service.test.ts`):
  1. Zeroed overview for a new workspace (0 counts, every stage 0, empty
     recent activities).
  2. Counts are workspace-scoped and correct (customers, deals, activities,
     members — the latter via an added membership).
  3. Pipeline stage counts are correct per stage with zero-fill for empty
     stages.
  4. Recent activities are limited to `RECENT_ACTIVITIES_LIMIT`, newest
     first.
  5. Cross-workspace isolation: workspace B's dashboard never reflects
     workspace A's customers/deals/activities/members (and vice versa).
  6. The service API is keyed by `workspaceId` only (no client identity) —
     a caller can only ever ask for one workspace's data; the page derives
     that id from the server session, so client-supplied workspace/user
     values cannot bypass isolation.
- Activities tests: `listRecentActivities` limits the result, orders newest
  first, and never returns another workspace's activities.

**Dependencies**

- Tasks 1–2.

**Verification**

- `pnpm test` passes.

### Task 6: Verification

**Purpose**

Run the full verification checklist.

**Files**

- None (verification only).

**Changes**

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — fix failures in
  Dashboard scope and re-run.

**Dependencies**

- All prior tasks.

**Verification**

- Checklist (section 9) satisfied.

## 6. Database Changes

**No database changes required.** `Customer`, `Deal` (with the `DealStage`
enum), `Activity`, and `Membership` all already carry `workspaceId` and the
timestamps the dashboard needs. All aggregations are reads over existing
models (`count` / `groupBy` / `findMany take`).

## 7. Authorization & Security

### Authentication requirements

- Dashboard access requires an authenticated session with a valid workspace
  membership (REQ-DASH-001). This is enforced by the existing chain:
  middleware redirects unauthenticated `/dashboard*` requests to `/login`
  (`src/middleware.ts`), the `(dashboard)` layout calls
  `requireSessionWorkspace()` (unauthenticated → `/login`, authenticated
  non-member → 404), and the page itself resolves its context through the
  same boundary. No new permission is defined for the Dashboard (the
  permission matrix grants "View Dashboard" to OWNER, MANAGER, and MEMBER).

### Workspace isolation

- Every aggregation in `getDashboardData` is keyed by the server-resolved
  `workspaceId` from the session workspace context. The page accepts no
  query parameters, no client state, and no client-supplied identity — there
  is no input path by which a client-provided `workspaceId`, `userId`, or
  `role` could reach the data layer (REQ-GEN-001, BR-AUTH-005).

### Validation

- The Dashboard is a read/aggregation feature with no user input and no
  filters (none are specified). No Zod schemas are required; none are added.
  The only numeric inputs are server-side constants.

### Security-sensitive failure cases

- A member of another workspace can never request another workspace's data:
  their session resolves to their own membership only, and the page queries
  solely with that id.
- Unauthenticated access → login redirect (existing boundary); authenticated
  non-member → 404 (existing boundary).
- Unexpected errors are contained by the dashboard `error.tsx` boundary
  without exposing internals (generic message, retry action).

## 8. Testing Plan

| Criterion | Test |
|---|---|
| REQ-DASH-001 (authenticated member access) | Covered by existing `session-workspace` tests (redirect/notFound/composition); dashboard service tests operate under a server-resolved workspace id |
| REQ-DASH-002 (CRM overview counts) | Dashboard service: counts match seeded customers/deals/activities/members |
| REQ-DASH-003 (pipeline state) | Dashboard service: per-stage counts, zero-fill for empty stages |
| REQ-DASH-004 (recent activities) | Dashboard service (limit + ordering) and activities service tests |
| REQ-GEN-001 (isolation) | Dashboard service: two workspaces, data never crosses; activities: `listRecentActivities` scoping |
| Client-trust rules | Service is keyed by `workspaceId` only (no client identity input); page derives it from the session |
| Empty/new workspace | Dashboard service: zeroed overview for a fresh workspace |
| Loading/error states | Loading skeleton + error boundary added (Next.js conventions); manual smoke |

## 9. Verification Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new dashboard tests + full suite)
- [ ] `pnpm build` passes
- [ ] REQ-DASH-001..004 verified
- [ ] Workspace isolation verified (counts, stages, activities, members)
- [ ] No client-supplied identity used anywhere in the dashboard data path
- [ ] Empty/new workspace renders usefully (getting-started + empty notes)
- [ ] No unrelated files changed

## 10. Risks & Open Questions

1. **Stat-card "Team members" metric.** REQ-DASH-002 requires "an overview of
   important CRM information"; the four MVP domains are Customers, Deals,
   Activities, and Team, and the Dashboard task explicitly lists team
   metrics as "workspace-scoped where applicable". The member count is the
   minimal team metric consistent with the spec — no role breakdown or
   member list is shown.
2. **No component-level tests.** The repository has no React component
   testing setup; consistent with all prior features, dashboard behavior is
   verified at the service/session boundaries plus manual UI smoke. If
   component tests are ever introduced, the page renders from
   `getDashboardData` and can be covered then.
3. **Recent-activity limit (5).** The spec requires "an overview of relevant
   recent activities" without a count. 5 is a presentation choice, not a
   product rule; the full feed remains available at `/activities`.
4. **No caching.** Queries are small counts plus a 5-row read; no caching is
   warranted for the MVP (and none is required by the spec).

## 11. Scope Confirmation

`READY_FOR_IMPLEMENTATION`

No new product or architecture decisions are required. The plan builds
exclusively on existing requirements (REQ-DASH-001–004), the existing
authorization boundary, and the existing domain data model. It introduces no
new metrics beyond the four core CRM overview counts (each explicitly listed
as a potential dashboard metric in the Dashboard task), no new permissions,
no database changes, and no new libraries. The plan is treated as approved
for this task and implemented in the same session.