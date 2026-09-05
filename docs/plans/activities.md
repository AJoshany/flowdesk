# FlowDesk — Activities Implementation Plan

## 1. Objective

Implement the Activities feature per `docs/features/activities.md` on top of
the existing Authentication, Workspace, Customers, and Deals implementations:

- Workspace members can record CRM activities and review recent activity.
- An activity belongs to exactly one workspace and may optionally reference a
  customer and/or a deal of the **same** workspace (either, both, or neither —
  `docs/architecture/database.md` §8).
- Every query and mutation is workspace-scoped; activity data is never
  reachable by id alone.
- The feature defines **no** update or delete — only creation and retrieval
  are implemented.

## 2. Scope

### In Scope

- Workspace activity feed (`/activities`) — US-ACT-002 / REQ-ACT-003.
- Activity creation (`/activities/new`) — US-ACT-001 / REQ-ACT-001, available
  to every workspace role (roles-permissions: "Create Activity" ✓ for
  OWNER/MANAGER/MEMBER).
- Optional, workspace-validated Customer and/or Deal association.
- Scoped retrieval in context: the customer detail page shows the customer's
  activities and the deal detail page shows the deal's activities
  (AC-ACT-002/003 — "when the customer/deal is viewed, the relevant activity
  can be retrieved").
- Workspace isolation, server-side authorization (existing boundary), Zod
  validation, loading/empty states, tests, verification gates.

### Out of Scope

- Activity update/delete/edit — the spec defines none.
- Activity "types"/kind, reminders, due dates, notifications, calendar/email
  integration, automation, dashboard analytics, Team.
- A dedicated activity detail page (nothing to edit; retrieval happens in the
  feed and in customer/deal context).
- Changes to Authentication/Workspace/Customers/Deals behavior beyond adding
  scoped read-only activity sections to the two detail pages.
- Unrelated refactoring.

## 3. Existing Repository Analysis

- **Auth/session** (`src/features/auth/session.ts`, `src/auth.ts`): Auth.js
  JWT; server-side session user; redirects for unauthenticated users.
- **Workspace boundary** (`src/features/workspace/`):
  `requireSessionWorkspace()` returns `{ user, workspace }` with the
  server-resolved primary workspace and role (404 for authenticated
  non-members, `/login` redirect when unauthenticated). `requireWorkspaceAccess`
  exists for explicit (userId, workspaceId) checks.
- **Customers & Deals** — the established module pattern to mirror:
  `schemas.ts` (Zod) → `service.ts` (workspace-scoped Prisma data access with
  `{ ok, code | value }` results) → `actions.ts` (`"use server"` actions,
  FormData + `requireSessionWorkspace`, redirect) → thin client form
  components (`useActionState`) + Server Component pages. `Deal` already
  validates optional same-workspace `customerId` associations the same way
  Activities needs.
- **Schema** (`prisma/schema.prisma`): `User`, `Workspace`, `Membership`,
  `Role`, `Customer`, `Deal` (+ `DealStage`). No `Activity` model yet.
- **Middleware**: `/activities` is already a protected prefix
  (unauthenticated → `/login?callbackUrl=…`).
- **Routing/UI**: dashboard shell `(dashboard)/layout.tsx` guarded by
  `requireSessionWorkspace`; `Sidebar.tsx` lists Dashboard / Customers /
  Deals / Settings — an Activities link must be added. Customer and Deal
  detail pages currently end with the edit + (role-gated) delete sections.
- **Testing**: Vitest + dedicated test DB (global setup truncates
  `Membership`/`Workspace`/`User` with `CASCADE`, so new FK tables are
  covered). Service tests seed via the real `registerUser` service and the
  Customers/Deals services; action tests mock
  `requireSessionWorkspace`/service modules.

## 4. Requirements Mapping

| Requirement | Where implemented |
| --- | --- |
| REQ-ACT-001 / US-ACT-001 (record an activity) | `createActivityAction` + `/activities/new` |
| REQ-ACT-002 (may associate customer and/or deal) | optional `customerId`/`dealId`, each verified in the same workspace |
| REQ-ACT-003 / US-ACT-002 (view activity history) | `/activities` feed + scoped sections on customer/deal detail pages |
| BR-ACT-001 (activity → one workspace) | `workspaceId` set server-side only |
| BR-ACT-002/003/004 (customer and/or deal, or neither) | nullable `customerId`/`dealId`, `SetNull` on delete |
| BR-ACT-005 (cross-workspace denial) | every read/mutation scoped by server-resolved `workspaceId` |
| AC-ACT-001 (create persists under the workspace) | create service + action test |
| AC-ACT-002 (retrieval when customer viewed) | customer detail "Recent activity" section |
| AC-ACT-003 (retrieval when deal viewed) | deal detail "Recent activity" section |
| AC-ACT-004 (foreign user denied) | boundary (404/nonexistent) + isolation tests |
| Roles: view/create for all roles; no delete/edit defined | actions available to every role; no delete/edit action exists |

Delegated decisions (documented, no product change):
- **No activity type/kind**: `database.md` §8 defers types to the feature
  spec, which defines none — so no enum is invented.
- **Content field**: `note` (required, trimmed, ≤ 2000 chars) is the recorded
  interaction text ("record an activity"); no other content fields exist in
  any spec.
- **FK semantics**: `Customer.onDelete: SetNull` and `Deal.onDelete: SetNull`
  (consistent with Deal→Customer): deleting a customer/deal leaves
  workspace-level activity history intact; deleting a workspace cascades.

## 5. Implementation Tasks

### Task 1 — Database

Add to `prisma/schema.prisma` (additive only):

```prisma
model Activity {
  id          String    @id @default(cuid())
  note        String
  customerId  String?
  customer    Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  dealId      String?
  deal        Deal?     @relation(fields: [dealId], references: [id], onDelete: SetNull)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([workspaceId])
  @@index([customerId])
  @@index([dealId])
}
```

`Customer`, `Deal`, and `Workspace` gain `activities Activity[]` back-relations.
Create the migration (`pnpm exec prisma migrate dev --name add_activity`),
inspect the SQL (must be additive), then `pnpm exec prisma generate` (migrate
dev does not refresh the generated client in this setup).

### Task 2 — Feature module (`src/features/activities/`)

- `schemas.ts` — Zod schemas mirroring Deals/Customers:
  - `note`: trimmed, required, ≤ 2000 chars.
  - optional association factory for `customerId`/`dealId`: missing/empty →
    `null`; otherwise shape-validated (`^[a-z0-9]*$`, ≤ 64) — existence and
    same-workspace membership are verified by the service.
  - `activityFieldsSchema` (note + optional customerId + optional dealId),
    `activityIdSchema`/`expectedUpdatedAtSchema` are NOT needed (no edit).
- `messages.ts` — validation prompt, invalid-reference message, generic
  error. No not-found/conflict/unauthorized-delete messages (no delete/edit).
- `service.ts` — server-only, workspace-scoped (never by id alone):
  - `activitySelect` includes `customer { id, name }` and `deal { id, title }`.
  - `listActivities(workspaceId)` — feed, newest first (REQ-ACT-003).
  - `listActivitiesForCustomer(workspaceId, customerId)` and
    `listActivitiesForDeal(workspaceId, dealId)` — scoped lists for the
    detail-page sections (AC-ACT-002/003); a foreign/missing resource id
    yields an empty list (no disclosure).
  - `createActivity(workspaceId, input)` — validates input; when a
    `customerId`/`dealId` is present, verifies the referenced row exists
    **in `workspaceId`** before creating; otherwise returns
    `invalid_reference` (no cross-workspace association).
- `actions.ts` — `"use server"`:
  - `createActivityAction` — parses FormData with Zod, resolves the session
    workspace via `requireSessionWorkspace()` (identity + workspace + role
    server-side; client-supplied workspace/user/role never read), calls the
    service, redirects to `/activities` on success. No delete/update actions
    (none defined).

### Task 3 — UI

- `src/app/(dashboard)/activities/page.tsx` — feed: header + "New activity"
  link, empty state, or an `ActivityList` of scoped rows (note, timestamp,
  linked customer/deal names).
- `src/app/(dashboard)/activities/new/page.tsx` — create page loading the
  workspace's customers and deals as association options.
- `src/app/(dashboard)/activities/loading.tsx` — skeleton (existing pattern).
- `src/features/activities/components/ActivityForm.tsx` — thin client form:
  note `<textarea>`, customer `<select>`, deal `<select>`, field errors,
  pending state.
- `src/features/activities/components/ActivityList.tsx` — server-renderable
  row list reused by the feed and the embedded sections (links to the
  customer and deal pages when present).
- Customer detail page: "Recent activity" section listing
  `listActivitiesForCustomer` + "Record activity" link to `/activities/new`.
- Deal detail page: same via `listActivitiesForDeal`.
- `src/app/components/layout/Sidebar.tsx` — add the Activities link between
  Deals and Settings.

### Task 4 — Tests

See §9 (`src/features/activities/*.test.ts`, established conventions).

## 6. Database Changes

One additive migration (`add_activity`): new `Activity` table
(`workspaceId` FK → Workspace `onDelete: Cascade`; nullable `customerId`/
`dealId` FKs with `onDelete: SetNull`; indexes on `workspaceId`,
`customerId`, `dealId`) plus `activities[]` back-relations on Customer, Deal,
Workspace. No destructive change.

## 7. Authorization & Security

- Identity: Auth.js session only (`requireSessionWorkspace`).
- Workspace: membership server-resolved; non-members denied (404) or
  redirected (unauthenticated).
- Reads: every list carries `workspaceId` in the WHERE clause
  (`listActivitiesForCustomer`/`listActivitiesForDeal` additionally scope by
  the resource id, so a foreign customer/deal simply has no activities).
- Associations: `customerId`/`dealId` from the client are validated **inside
  the session workspace** before linking; a well-formed id from another
  workspace behaves like an unknown one (`invalid_reference`).
- Roles: view/create are permitted for all workspace roles (the only
  permissions defined); no delete/edit surface exists, so there is no
  privileged mutation to gate.
- No client-provided `userId`, `workspaceId`, or `role` is ever read.

## 8. Validation

Zod at the server boundary: note (required, trimmed, ≤ 2000), association id
shape + optionality, and same-workspace existence checks in the service.
Client-side validation is convenience only.

## 9. Testing Plan

- **schemas.test.ts** — note required/blank/too long; customerId/dealId
  missing/empty → null; malformed ids rejected; customer-only, deal-only,
  both, and neither associations accepted.
- **service.test.ts** (integration, test DB): create under the given
  workspace with row check (AC-ACT-001); associations with same-workspace
  customer, deal, and both (BR-ACT-002/003/004); workspace-level activity
  with neither; foreign-customer and foreign-deal references →
  `invalid_reference` with nothing persisted; unknown ids → same; blank note
  → `invalid_input`; feed isolation (AC-ACT-004: workspace A never sees
  workspace B's activities); newest-first ordering; customer-scoped list
  returns only that customer's activities and is empty for a foreign
  customer id (AC-ACT-002); deal-scoped list likewise (AC-ACT-003); deleting
  a customer/deal keeps the activity row (SetNull) — workspace history
  survives.
- **actions.test.ts** (mocked `requireSessionWorkspace` + service + redirect):
  create uses the server-resolved workspace; MEMBER (and OWNER) can create —
  role rules define no restriction; client-supplied `workspaceId`/`role`/
  `userId` ignored; invalid note → field errors, service not called;
  malformed association ids → field errors; `invalid_reference` →
  message mapping, no redirect; unauthenticated → login redirect and
  non-member → notFound propagate from the boundary; success redirects to
  `/activities`.

## 10. Verification Checklist

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## 11. Risks & Open Questions

- **Delegated**: activity "types" (call/meeting/email…) are deferred by
  database.md §8 and never defined by the feature spec, so the MVP records a
  free-text note only. If CRM requirements later define activity kinds, an
  additive migration + enum can extend the model.
- AC-ACT-002/003 are satisfied by the customer/deal detail sections; a
  future richer activity model may warrant filtering/search on the feed
  (out of scope now).
- Multi-workspace UX remains out of scope; the primary-workspace context
  from Authentication is unchanged.

## 12. Scope Confirmation

Only the Activities feature: one additive migration; module + tests; feed and
create pages; read-only activity sections appended to the existing customer
and deal detail pages; sidebar link. No update/delete/edit UI, no activity
types, no Team/dashboard/notifications/automation, no unrelated refactoring.
